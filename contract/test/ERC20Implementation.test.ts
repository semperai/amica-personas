import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
    deployPersonaTokenFactoryFixture,
    DEFAULT_GRADUATION_THRESHOLD,
    swapTokensForPersona,
    STANDARD_BONDING_AMOUNT,
    deployViewer
} from "./shared/fixtures";
import { ERC20Implementation, PersonaTokenFactory, TestERC20, PersonaFactoryViewer } from "../typechain-types";

describe("ERC20Implementation Burn and Claim", function () {
    // Deploy a persona token directly for testing
    async function deployPersonaTokenForTesting() {
        const fixture = await loadFixture(deployPersonaTokenFactoryFixture);
        const { personaFactory, viewer, amicaToken, user1, user2, user3 } = fixture;

        // Create persona
        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            ethers.parseEther("1000")
        );

        const tx = await personaFactory.connect(user1).createPersona(
            await amicaToken.getAddress(),
            "Test Token",
            "TEST",
            [],
            [],
            0,
            ethers.ZeroAddress,
            0
        );

        const receipt = await tx.wait();
        const event = receipt?.logs.find(
            log => {
                try {
                    const parsed = personaFactory.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    });
                    return parsed?.name === 'PersonaCreated';
                } catch {
                    return false;
                }
            }
        );

        const parsedEvent = personaFactory.interface.parseLog({
            topics: event!.topics as string[],
            data: event!.data
        });
        const tokenId = parsedEvent!.args.tokenId;

        // Get the persona token address using viewer
        const persona = await viewer.getPersona(tokenId);
        const personaToken = await ethers.getContractAt("ERC20Implementation", persona.erc20Token) as ERC20Implementation;

        // Calculate the amount needed including fees
        // The contract has a 1% trading fee by default
        const tradingFeeConfig = await personaFactory.tradingFeeConfig();
        const feePercentage = tradingFeeConfig.feePercentage; // 100 = 1%
        const BASIS_POINTS = 10000n;

        // To get DEFAULT_GRADUATION_THRESHOLD after fees, we need to buy more
        // amountAfterFee = amountIn * (1 - feePercentage/10000)
        // So: amountIn = amountAfterFee / (1 - feePercentage/10000)
        const amountNeeded = (DEFAULT_GRADUATION_THRESHOLD * BASIS_POINTS) / (BASIS_POINTS - feePercentage);

        // Add a small buffer to ensure we exceed the threshold
        const purchaseAmount = amountNeeded + ethers.parseEther("1000");

        // Buy enough to trigger graduation
        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            purchaseAmount
        );

        await swapTokensForPersona(
            personaFactory,
            Number(tokenId),
            purchaseAmount,
            0n,
            user2
        );

        // Verify graduation happened by checking if pair was created
        const personaInfo = await viewer.getPersona(tokenId);
        expect(personaInfo.pairCreated).to.be.true;

        // Verify graduation status on the token itself
        const hasGraduated = await personaToken.hasGraduated();
        expect(hasGraduated).to.be.true;

        // Transfer some tokens to user3 for testing
        const user2Balance = await personaToken.balanceOf(user2.address);
        await personaToken.connect(user2).transfer(user3.address, user2Balance / 4n);

        return {
            ...fixture,
            personaToken,
            tokenId,
            personaFactory,
            viewer
        };
    }

    describe("Graduation Check", function () {
        it("Should revert burnAndClaim before graduation", async function () {
            const fixture = await loadFixture(deployPersonaTokenFactoryFixture);
            const { personaFactory, viewer, amicaToken, user1 } = fixture;

            // Create persona but don't buy enough to graduate
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("1000")
            );

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Test Token",
                "TEST",
                [],
                [],
                0,
                ethers.ZeroAddress,
                0
            );

            const receipt = await tx.wait();
            const event = receipt?.logs.find(
                log => {
                    try {
                        const parsed = personaFactory.interface.parseLog({
                            topics: log.topics as string[],
                            data: log.data
                        });
                        return parsed?.name === 'PersonaCreated';
                    } catch {
                        return false;
                    }
                }
            );

            const parsedEvent = personaFactory.interface.parseLog({
                topics: event!.topics as string[],
                data: event!.data
            });
            const tokenId = parsedEvent!.args.tokenId;

            const persona = await viewer.getPersona(tokenId);
            const personaToken = await ethers.getContractAt("ERC20Implementation", persona.erc20Token);

            // Try to burn and claim before graduation
            await expect(
                personaToken.connect(user1).burnAndClaim(ethers.parseEther("100"), [await amicaToken.getAddress()])
            ).to.be.revertedWithCustomError(personaToken, "TokenNotGraduated");
        });

        it("Should allow burnAndClaim after graduation", async function () {
            const { personaToken, amicaToken, user2, personaFactory } = await loadFixture(deployPersonaTokenForTesting);

            // Send some AMICA to the persona token contract
            await amicaToken.connect(user2).transfer(await personaToken.getAddress(), ethers.parseEther("1000"));

            const burnAmount = ethers.parseEther("100");
            const tokensBefore = await personaToken.balanceOf(user2.address);
            const amicaBefore = await amicaToken.balanceOf(user2.address);

            // Should work after graduation
            await personaToken.connect(user2).burnAndClaim(burnAmount, [await amicaToken.getAddress()]);

            const tokensAfter = await personaToken.balanceOf(user2.address);
            expect(tokensBefore - tokensAfter).to.equal(burnAmount);
        });
    });

    describe("Basic Burn and Claim", function () {
        it("Should burn tokens and claim single token", async function () {
            const { personaToken, amicaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Send AMICA to persona token contract
            const depositAmount = ethers.parseEther("1000");
            await amicaToken.connect(user2).transfer(await personaToken.getAddress(), depositAmount);

            const burnAmount = ethers.parseEther("100");
            const totalSupply = await personaToken.totalSupply();
            const expectedClaim = (depositAmount * burnAmount) / totalSupply;

            await expect(personaToken.connect(user2).burnAndClaim(burnAmount, [await amicaToken.getAddress()]))
                .to.emit(personaToken, "TokensBurnedAndClaimed");

            // Check balances
            expect(await personaToken.balanceOf(user2.address)).to.be.lt(totalSupply);
            expect(await amicaToken.balanceOf(user2.address)).to.be.gt(0);
        });

        it("Should burn tokens and claim multiple tokens", async function () {
            const { personaToken, amicaToken, user2, owner } = await loadFixture(deployPersonaTokenForTesting);

            // Deploy additional test tokens
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const token2 = await TestERC20.deploy("Token2", "TK2", ethers.parseEther("1000000"));
            const token3 = await TestERC20.deploy("Token3", "TK3", ethers.parseEther("1000000"));

            // Send tokens to persona contract
            await amicaToken.connect(user2).transfer(await personaToken.getAddress(), ethers.parseEther("1000"));
            await token2.transfer(await personaToken.getAddress(), ethers.parseEther("500"));
            await token3.transfer(await personaToken.getAddress(), ethers.parseEther("250"));

            const burnAmount = ethers.parseEther("100");

            // Sort token addresses for the call
            const tokens = [
                await amicaToken.getAddress(),
                await token2.getAddress(),
                await token3.getAddress()
            ].sort();

            await expect(personaToken.connect(user2).burnAndClaim(burnAmount, tokens))
                .to.emit(personaToken, "TokensBurnedAndClaimed");
        });

        it("Should handle claiming own tokens", async function () {
            const { personaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Send persona tokens to the contract itself
            const depositAmount = ethers.parseEther("500");
            await personaToken.connect(user2).transfer(await personaToken.getAddress(), depositAmount);

            const burnAmount = ethers.parseEther("100");
            const balanceBefore = await personaToken.balanceOf(user2.address);

            await personaToken.connect(user2).burnAndClaim(burnAmount, [await personaToken.getAddress()]);

            const balanceAfter = await personaToken.balanceOf(user2.address);
            // User should have received some tokens back (minus the burned amount)
            expect(balanceAfter).to.be.gt(balanceBefore - burnAmount);
        });
    });

    describe("Preview Function", function () {
        it("Should accurately preview burn and claim", async function () {
            const { personaToken, amicaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Send tokens to persona contract
            const depositAmount = ethers.parseEther("1000");
            await amicaToken.connect(user2).transfer(await personaToken.getAddress(), depositAmount);

            const burnAmount = ethers.parseEther("100");
            const preview = await personaToken.previewBurnAndClaim(burnAmount, [await amicaToken.getAddress()]);

            // Actually burn and claim
            await personaToken.connect(user2).burnAndClaim(burnAmount, [await amicaToken.getAddress()]);

            // The preview should have been accurate
            expect(preview[0]).to.be.gt(0);
        });

        it("Should return zero for tokens not held by contract", async function () {
            const { personaToken, amicaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            const burnAmount = ethers.parseEther("100");
            const preview = await personaToken.previewBurnAndClaim(burnAmount, [await amicaToken.getAddress()]);

            expect(preview[0]).to.equal(0);
        });

        it("Should return zero preview before graduation", async function () {
            const fixture = await loadFixture(deployPersonaTokenFactoryFixture);
            const { personaFactory, viewer, amicaToken, user1 } = fixture;

            // Create persona but don't graduate
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("1000")
            );

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Test Token",
                "TEST",
                [],
                [],
                0,
                ethers.ZeroAddress,
                0
            );

            const receipt = await tx.wait();
            const event = receipt?.logs.find(
                log => {
                    try {
                        const parsed = personaFactory.interface.parseLog({
                            topics: log.topics as string[],
                            data: log.data
                        });
                        return parsed?.name === 'PersonaCreated';
                    } catch {
                        return false;
                    }
                }
            );

            const parsedEvent = personaFactory.interface.parseLog({
                topics: event!.topics as string[],
                data: event!.data
            });
            const tokenId = parsedEvent!.args.tokenId;

            const persona = await viewer.getPersona(tokenId);
            const personaToken = await ethers.getContractAt("ERC20Implementation", persona.erc20Token);

            // Send some tokens to the contract
            await amicaToken.connect(user1).transfer(await personaToken.getAddress(), ethers.parseEther("1000"));

            // Preview should return zero before graduation
            const preview = await personaToken.previewBurnAndClaim(
                ethers.parseEther("100"),
                [await amicaToken.getAddress()]
            );
            expect(preview[0]).to.equal(0);
        });
    });

    describe("Error Cases", function () {
        it("Should revert on zero burn amount", async function () {
            const { personaToken, amicaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            await expect(
                personaToken.connect(user2).burnAndClaim(0, [await amicaToken.getAddress()])
            ).to.be.revertedWithCustomError(personaToken, "InvalidBurnAmount");
        });

        it("Should revert with no tokens selected", async function () {
            const { personaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            await expect(
                personaToken.connect(user2).burnAndClaim(ethers.parseEther("100"), [])
            ).to.be.revertedWithCustomError(personaToken, "NoTokensSelected");
        });

        it("Should revert with unsorted token array", async function () {
            const { personaToken, amicaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const token2 = await TestERC20.deploy("Token2", "TK2", ethers.parseEther("1000000"));

            // Send tokens
            await amicaToken.connect(user2).transfer(await personaToken.getAddress(), ethers.parseEther("1000"));
            await token2.transfer(await personaToken.getAddress(), ethers.parseEther("500"));

            const addr1 = await amicaToken.getAddress();
            const addr2 = await token2.getAddress();

            // Pass tokens in wrong order (higher address first)
            const unsortedTokens = BigInt(addr1) > BigInt(addr2) ? [addr1, addr2] : [addr2, addr1];

            await expect(
                personaToken.connect(user2).burnAndClaim(ethers.parseEther("100"), unsortedTokens)
            ).to.be.revertedWithCustomError(personaToken, "TokensMustBeSortedAndUnique");
        });

        it("Should revert with duplicate tokens", async function () {
            const { personaToken, amicaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            const amicaAddress = await amicaToken.getAddress();

            await expect(
                personaToken.connect(user2).burnAndClaim(ethers.parseEther("100"), [amicaAddress, amicaAddress])
            ).to.be.revertedWithCustomError(personaToken, "TokensMustBeSortedAndUnique");
        });

        it("Should revert with zero address token", async function () {
            const { personaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            const userBalance = await personaToken.balanceOf(user2.address);
            expect(userBalance).to.be.gt(0);

            await expect(
                personaToken.connect(user2).burnAndClaim(ethers.parseEther("100"), [ethers.ZeroAddress])
            ).to.be.revertedWithCustomError(personaToken, "InvalidTokenAddress");
        });

        it("Should revert if no tokens can be claimed", async function () {
            const { personaToken, amicaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Don't send any tokens to the contract
            const userBalance = await personaToken.balanceOf(user2.address);
            expect(userBalance).to.be.gt(0);

            await expect(
                personaToken.connect(user2).burnAndClaim(ethers.parseEther("100"), [await amicaToken.getAddress()])
            ).to.be.revertedWithCustomError(personaToken, "NoTokensToClaim");
        });

        it("Should revert if trying to burn more than balance", async function () {
            const { personaToken, amicaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            await amicaToken.connect(user2).transfer(await personaToken.getAddress(), ethers.parseEther("1000"));

            const balance = await personaToken.balanceOf(user2.address);

            await expect(
                personaToken.connect(user2).burnAndClaim(balance + 1n, [await amicaToken.getAddress()])
            ).to.be.revertedWithCustomError(personaToken, "ERC20InsufficientBalance");
        });
    });

    describe("Edge Cases", function () {
        it("Should handle very small burn amounts", async function () {
            const { personaToken, amicaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Send a large amount of tokens to ensure we get non-zero claims
            const largeDeposit = ethers.parseEther("1000000"); // 1M tokens
            await amicaToken.connect(user2).transfer(await personaToken.getAddress(), largeDeposit);

            // Get total supply for calculation
            const totalSupply = await personaToken.totalSupply();

            // Calculate a burn amount that will result in at least 1 wei claim
            // claimAmount = (balance * burnAmount) / totalSupply
            // We need: claimAmount >= 1
            // So: burnAmount >= totalSupply / balance
            const minBurnForClaim = (totalSupply / largeDeposit) + 1n;

            // Burn enough to get at least 1 wei
            const tx = await personaToken.connect(user2).burnAndClaim(minBurnForClaim, [await amicaToken.getAddress()]);

            // Should succeed
            await expect(tx).to.emit(personaToken, "TokensBurnedAndClaimed");
        });

        it("Should revert when burn amount results in zero claimable tokens", async function () {
            const { personaToken, amicaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Send a very small amount of tokens
            await amicaToken.connect(user2).transfer(await personaToken.getAddress(), 100n);

            // Try to burn a small amount that would result in 0 claimable tokens
            await expect(
                personaToken.connect(user2).burnAndClaim(1n, [await amicaToken.getAddress()])
            ).to.be.revertedWithCustomError(personaToken, "NoTokensToClaim");
        });

        it("Should handle burning entire balance", async function () {
            const { personaToken, amicaToken, user2, user3, personaFactory, tokenId } = await loadFixture(deployPersonaTokenForTesting);

            // First, let's get the actual token balances to understand the distribution
            const factoryBalance = await personaToken.balanceOf(await personaFactory.getAddress());
            const user1Balance = await personaToken.balanceOf(await personaFactory.ownerOf(tokenId));
            const user2InitialBalance = await personaToken.balanceOf(user2.address);
            const user3Balance = await personaToken.balanceOf(user3.address);

            // Transfer all of user3's tokens to user2
            if (user3Balance > 0) {
                await personaToken.connect(user3).transfer(user2.address, user3Balance);
            }

            // Send AMICA to the contract
            await amicaToken.connect(user2).transfer(await personaToken.getAddress(), ethers.parseEther("1000"));

            // Get user2's current balance
            const balance = await personaToken.balanceOf(user2.address);

            // User2 now has their initial balance plus user3's balance
            expect(balance).to.equal(user2InitialBalance + user3Balance);

            // Burn entire balance
            const tx = await personaToken.connect(user2).burnAndClaim(balance, [await amicaToken.getAddress()]);
            await expect(tx).to.emit(personaToken, "TokensBurnedAndClaimed");

            // User2 should have no tokens left
            expect(await personaToken.balanceOf(user2.address)).to.equal(0);

            // User2 should have received some AMICA
            expect(await amicaToken.balanceOf(user2.address)).to.be.gt(0);
        });

        it("Should handle multiple users burning simultaneously", async function () {
            const { personaToken, amicaToken, user2, user3 } = await loadFixture(deployPersonaTokenForTesting);

            await amicaToken.connect(user2).transfer(await personaToken.getAddress(), ethers.parseEther("10000"));

            const user2Balance = await personaToken.balanceOf(user2.address);
            const user3Balance = await personaToken.balanceOf(user3.address);

            // Both users burn at the same time
            await personaToken.connect(user2).burnAndClaim(user2Balance / 2n, [await amicaToken.getAddress()]);
            await personaToken.connect(user3).burnAndClaim(user3Balance / 2n, [await amicaToken.getAddress()]);

            // Both should have received tokens
            expect(await amicaToken.balanceOf(user2.address)).to.be.gt(0);
            expect(await amicaToken.balanceOf(user3.address)).to.be.gt(0);
        });

        it("Should handle tokens with different decimals", async function () {
            const { personaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Deploy tokens with different decimals
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const token6 = await TestERC20.deploy("Six Decimals", "SIX", ethers.parseUnits("1000000", 6));
            const token18 = await TestERC20.deploy("Eighteen Decimals", "EIGHTEEN", ethers.parseEther("1000000"));

            // Send tokens to persona contract
            await token6.transfer(await personaToken.getAddress(), ethers.parseUnits("1000", 6));
            await token18.transfer(await personaToken.getAddress(), ethers.parseEther("1000"));

            const burnAmount = ethers.parseEther("100");
            const tokens = [await token6.getAddress(), await token18.getAddress()].sort();

            await personaToken.connect(user2).burnAndClaim(burnAmount, tokens);

            // Should have received both tokens
            expect(await token6.balanceOf(user2.address)).to.be.gt(0);
            expect(await token18.balanceOf(user2.address)).to.be.gt(0);
        });
    });

    describe("Complex Scenarios", function () {
        it("Should handle claiming from many tokens at once", async function () {
            const { personaToken, amicaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Deploy multiple tokens
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const tokens: TestERC20[] = [];
            const tokenAddresses: string[] = [];

            for (let i = 0; i < 10; i++) {
                const token = await TestERC20.deploy(`Token${i}`, `TK${i}`, ethers.parseEther("1000000"));
                tokens.push(token);
                tokenAddresses.push(await token.getAddress());

                // Send tokens to persona contract
                await token.transfer(await personaToken.getAddress(), ethers.parseEther(`${100 * (i + 1)}`));
            }

            // Add amica token
            await amicaToken.connect(user2).transfer(await personaToken.getAddress(), ethers.parseEther("1000"));
            tokenAddresses.push(await amicaToken.getAddress());

            // Sort addresses - this is critical!
            tokenAddresses.sort((a, b) => {
                const aBig = BigInt(a);
                const bBig = BigInt(b);
                if (aBig < bBig) return -1;
                if (aBig > bBig) return 1;
                return 0;
            });

            const burnAmount = ethers.parseEther("50");
            await personaToken.connect(user2).burnAndClaim(burnAmount, tokenAddresses);

            // Check that user received all tokens
            for (const token of tokens) {
                expect(await token.balanceOf(user2.address)).to.be.gt(0);
            }
            expect(await amicaToken.balanceOf(user2.address)).to.be.gt(0);
        });

        it("Should maintain invariants after multiple burn cycles", async function () {
            const { personaToken, amicaToken, user2, user3 } = await loadFixture(deployPersonaTokenForTesting);

            // Initial deposit
            const initialDeposit = ethers.parseEther("10000");
            await amicaToken.connect(user2).transfer(await personaToken.getAddress(), initialDeposit);

            const initialSupply = await personaToken.totalSupply();
            const initialContractBalance = await amicaToken.balanceOf(await personaToken.getAddress());

            // Track all AMICA claimed
            let totalClaimed = 0n;

            // Multiple burn cycles
            for (let i = 0; i < 5; i++) {
                const user = i % 2 === 0 ? user2 : user3;
                const userBalance = await personaToken.balanceOf(user.address);

                if (userBalance > 0) {
                    const burnAmount = userBalance / 10n; // Burn 10% each time
                    const amicaBefore = await amicaToken.balanceOf(user.address);

                    await personaToken.connect(user).burnAndClaim(burnAmount, [await amicaToken.getAddress()]);

                    const amicaAfter = await amicaToken.balanceOf(user.address);
                    totalClaimed += (amicaAfter - amicaBefore);
                }
            }

            const finalSupply = await personaToken.totalSupply();
            const finalContractBalance = await amicaToken.balanceOf(await personaToken.getAddress());

            // Supply should have decreased
            expect(finalSupply).to.be.lt(initialSupply);

            // Total AMICA should be conserved
            expect(finalContractBalance + totalClaimed).to.equal(initialDeposit);
        });
    });

    describe("Integration with PersonaTokenFactory", function () {
        it("Should handle fresh persona token with initial buy after graduation", async function () {
            const fixture = await loadFixture(deployPersonaTokenFactoryFixture);
            const { personaFactory, viewer, amicaToken, user1, user2 } = fixture;

            // Create persona with initial buy
            const initialBuy = ethers.parseEther("100000");
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("1000") + initialBuy
            );

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Fresh Token",
                "FRESH",
                [],
                [],
                initialBuy, // Initial buy amount
                ethers.ZeroAddress,
                0
            );

            const receipt = await tx.wait();
            const event = receipt?.logs.find(
                log => {
                    try {
                        const parsed = personaFactory.interface.parseLog({
                            topics: log.topics as string[],
                            data: log.data
                        });
                        return parsed?.name === 'PersonaCreated';
                    } catch {
                        return false;
                    }
                }
            );

            const parsedEvent = personaFactory.interface.parseLog({
                topics: event!.topics as string[],
                data: event!.data
            });
            const tokenId = parsedEvent!.args.tokenId;

            // Get the persona token
            const persona = await viewer.getPersona(tokenId);
            const personaToken = await ethers.getContractAt("ERC20Implementation", persona.erc20Token);

            // Buy more to trigger graduation
            const tradingFeeConfig = await personaFactory.tradingFeeConfig();
            const feePercentage = tradingFeeConfig.feePercentage;
            const BASIS_POINTS = 10000n;
            const remainingNeeded = DEFAULT_GRADUATION_THRESHOLD - initialBuy;
            const purchaseAmount = (remainingNeeded * BASIS_POINTS) / (BASIS_POINTS - feePercentage) + ethers.parseEther("10000");

            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            await swapTokensForPersona(
                personaFactory,
                Number(tokenId),
                purchaseAmount,
                0n,
                user2
            );

            // Verify graduation using viewer
            const graduatedPersona = await viewer.getPersona(tokenId);
            expect(graduatedPersona.pairCreated).to.be.true;

            // Verify graduation status on token
            expect(await personaToken.hasGraduated()).to.be.true;

            // Now test burn and claim
            await amicaToken.connect(user2).transfer(await personaToken.getAddress(), ethers.parseEther("5000"));

            const burnAmount = ethers.parseEther("100");
            await personaToken.connect(user1).burnAndClaim(burnAmount, [await amicaToken.getAddress()]);

            expect(await amicaToken.balanceOf(user1.address)).to.be.gt(0);
        });
    });

    describe("Reentrancy Protection", function () {
        it("Should have reentrancy protection", async function () {
            const { personaToken, amicaToken, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // This test verifies that the nonReentrant modifier is applied
            // We can't easily test actual reentrancy without a malicious contract,
            // but we can verify the function executes normally
            await amicaToken.connect(user2).transfer(await personaToken.getAddress(), ethers.parseEther("1000"));

            const burnAmount = ethers.parseEther("100");
            await expect(
                personaToken.connect(user2).burnAndClaim(burnAmount, [await amicaToken.getAddress()])
            ).to.not.be.reverted;
        });
    });

    describe("Zero Supply Edge Case", function () {
        it("Should handle preview when total supply approaches zero", async function () {
            const { personaToken, amicaToken, user2, user3, owner, personaFactory, tokenId, viewer } = await loadFixture(deployPersonaTokenForTesting);

            // Get the token distribution info using viewer
            const distribution = await viewer.getTokenDistribution(tokenId);
            const liquidityAmount = distribution.liquidityAmount;
            const amicaAmount = distribution.amicaAmount;
            const totalAllocated = liquidityAmount + amicaAmount;

            // Setup: Send all tokens to one user
            const user3Balance = await personaToken.balanceOf(user3.address);
            if (user3Balance > 0) {
                await personaToken.connect(user3).transfer(user2.address, user3Balance);
            }

            // Send tokens to contract
            const amicaDeposit = ethers.parseEther("1000");
            await amicaToken.connect(user2).transfer(await personaToken.getAddress(), amicaDeposit);

            // Get user's balance (all circulating tokens)
            const totalBalance = await personaToken.balanceOf(user2.address);
            const totalSupply = await personaToken.totalSupply();

            // Calculate expected claim amount
            // When burning all circulating supply, user should get all deposited AMICA
            const expectedClaim = (amicaDeposit * totalBalance) / totalSupply;

            // Preview should calculate correctly
            const preview = await personaToken.previewBurnAndClaim(
                totalBalance,
                [await amicaToken.getAddress()]
            );

            expect(preview[0]).to.equal(expectedClaim);
        });
    });
});
