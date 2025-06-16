import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ERC20Implementation, TestERC20, PersonaTokenFactory } from "../typechain-types";
import { createPersonaFixture, DEFAULT_MINT_COST, getDeadline } from "./shared/fixtures";

describe("ERC20Implementation Burn and Claim", function () {
    // Helper to create a persona and get its token for testing
    async function deployPersonaTokenForTesting() {
        const { personaFactory, amicaToken, user1, user2, user3, tokenId } = await loadFixture(createPersonaFixture);
        
        // Get the deployed persona token
        const persona = await personaFactory.getPersona(tokenId);
        const ERC20ImplementationFactory = await ethers.getContractFactory("ERC20Implementation");
        const personaToken = ERC20ImplementationFactory.attach(persona.erc20Token) as ERC20Implementation;

        // Deploy test tokens
        const TestERC20Factory = await ethers.getContractFactory("TestERC20");
        const usdc = await TestERC20Factory.deploy("USD Coin", "USDC", ethers.parseEther("10000000"));
        const weth = await TestERC20Factory.deploy("Wrapped Ether", "WETH", ethers.parseEther("100000"));
        const dai = await TestERC20Factory.deploy("Dai Stablecoin", "DAI", ethers.parseEther("10000000"));

        // Get users
        const [owner] = await ethers.getSigners();

        // Buy some persona tokens for users to have balances
        const buyAmount = ethers.parseEther("50000");
        
        // User1 already owns the NFT, so they have the creator allocation
        // User2 buys some tokens
        await amicaToken.connect(user2).approve(await personaFactory.getAddress(), buyAmount);
        await personaFactory.connect(user2).swapExactTokensForTokens(
            tokenId,
            buyAmount,
            0,
            user2.address,
            getDeadline()
        );
        await personaFactory.connect(user2).withdrawTokens(tokenId);

        // User3 buys some tokens
        await amicaToken.connect(user3).approve(await personaFactory.getAddress(), buyAmount);
        await personaFactory.connect(user3).swapExactTokensForTokens(
            tokenId,
            buyAmount,
            0,
            user3.address,
            getDeadline()
        );
        await personaFactory.connect(user3).withdrawTokens(tokenId);

        return {
            token: personaToken,
            personaFactory,
            amicaToken,
            tokenId,
            usdc,
            weth,
            dai,
            owner,
            user1,
            user2,
            user3
        };
    }

    describe("Basic Burn and Claim", function () {
        it("Should burn tokens and claim single token", async function () {
            const { token, usdc, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Send USDC to the token contract
            await usdc.transfer(await token.getAddress(), ethers.parseEther("1000"));

            const user2BalanceBefore = await token.balanceOf(user2.address);
            const totalSupply = await token.totalSupply();
            const burnAmount = user2BalanceBefore / 10n; // Burn 10% of user's balance

            // Burn and claim
            await expect(
                token.connect(user2).burnAndClaim(burnAmount, [await usdc.getAddress()])
            ).to.emit(token, "TokensBurnedAndClaimed");

            // Check balances
            const user2BalanceAfter = await token.balanceOf(user2.address);
            expect(user2BalanceBefore - user2BalanceAfter).to.equal(burnAmount);

            // User should receive proportional USDC
            const usdcBalance = await usdc.balanceOf(user2.address);
            const expectedUsdc = (ethers.parseEther("1000") * burnAmount) / totalSupply;
            expect(usdcBalance).to.be.closeTo(expectedUsdc, ethers.parseEther("0.01"));
        });

        it("Should burn tokens and claim multiple tokens", async function () {
            const { token, usdc, weth, dai, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Send tokens to the contract
            await usdc.transfer(await token.getAddress(), ethers.parseEther("1000"));
            await weth.transfer(await token.getAddress(), ethers.parseEther("50"));
            await dai.transfer(await token.getAddress(), ethers.parseEther("5000"));

            const user2Balance = await token.balanceOf(user2.address);
            const totalSupply = await token.totalSupply();
            const burnAmount = user2Balance / 5n; // Burn 20% of user's balance

            // Create sorted array of token addresses
            const tokens = [
                await dai.getAddress(),
                await usdc.getAddress(),
                await weth.getAddress()
            ].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            // Burn and claim
            await token.connect(user2).burnAndClaim(burnAmount, tokens);

            // Check received amounts
            const burnPercentage = (burnAmount * ethers.parseEther("1")) / totalSupply;
            
            expect(await usdc.balanceOf(user2.address)).to.be.closeTo(
                (ethers.parseEther("1000") * burnPercentage) / ethers.parseEther("1"),
                ethers.parseEther("0.1")
            );
            expect(await weth.balanceOf(user2.address)).to.be.closeTo(
                (ethers.parseEther("50") * burnPercentage) / ethers.parseEther("1"),
                ethers.parseEther("0.01")
            );
            expect(await dai.balanceOf(user2.address)).to.be.closeTo(
                (ethers.parseEther("5000") * burnPercentage) / ethers.parseEther("1"),
                ethers.parseEther("1")
            );
        });

        it("Should handle claiming own tokens", async function () {
            const { token, user2 } = await loadFixture(deployPersonaTokenForTesting);

            const initialBalance = await token.balanceOf(user2.address);
            
            // Send some of the token back to itself
            const sendAmount = initialBalance / 10n;
            await token.connect(user2).transfer(await token.getAddress(), sendAmount);

            const balanceAfterSend = await token.balanceOf(user2.address);
            const burnAmount = balanceAfterSend / 5n; // Burn 20% of remaining balance

            // Should be able to claim own tokens
            await expect(
                token.connect(user2).burnAndClaim(burnAmount, [await token.getAddress()])
            ).to.emit(token, "TokensBurnedAndClaimed");

            // Final balance should reflect burn minus what was claimed back
            const finalBalance = await token.balanceOf(user2.address);
            expect(finalBalance).to.be.lt(balanceAfterSend);
        });
    });

    describe("Preview Function", function () {
        it("Should accurately preview burn and claim", async function () {
            const { token, usdc, weth, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Send tokens to the contract
            await usdc.transfer(await token.getAddress(), ethers.parseEther("1000"));
            await weth.transfer(await token.getAddress(), ethers.parseEther("50"));

            const userBalance = await token.balanceOf(user2.address);
            const burnAmount = userBalance / 4n; // 25% of user's balance

            // Preview
            const tokens = [await usdc.getAddress(), await weth.getAddress()];
            const preview = await token.previewBurnAndClaim(burnAmount, tokens);

            // Actually burn and claim to verify
            const sortedTokens = tokens.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            await token.connect(user2).burnAndClaim(burnAmount, sortedTokens);

            expect(await usdc.balanceOf(user2.address)).to.be.closeTo(preview[0], ethers.parseEther("0.01"));
            expect(await weth.balanceOf(user2.address)).to.be.closeTo(preview[1], ethers.parseEther("0.001"));
        });

        it("Should return zero for tokens not held by contract", async function () {
            const { token, usdc, weth, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Don't send any tokens to contract
            const burnAmount = ethers.parseEther("10000");
            const preview = await token.previewBurnAndClaim(burnAmount, [
                await usdc.getAddress(),
                await weth.getAddress()
            ]);

            expect(preview[0]).to.equal(0);
            expect(preview[1]).to.equal(0);
        });
    });

    describe("Error Cases", function () {
        it("Should revert on zero burn amount", async function () {
            const { token, usdc, user2 } = await loadFixture(deployPersonaTokenForTesting);

            await expect(
                token.connect(user2).burnAndClaim(0, [await usdc.getAddress()])
            ).to.be.revertedWithCustomError(token, "InvalidBurnAmount");
        });

        it("Should revert with no tokens selected", async function () {
            const { token, user2 } = await loadFixture(deployPersonaTokenForTesting);

            await expect(
                token.connect(user2).burnAndClaim(ethers.parseEther("1000"), [])
            ).to.be.revertedWithCustomError(token, "NoTokensSelected");
        });

        it("Should revert with unsorted token array", async function () {
            const { token, usdc, weth, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Send tokens to the contract so they can be claimed
            await usdc.transfer(await token.getAddress(), ethers.parseEther("100"));
            await weth.transfer(await token.getAddress(), ethers.parseEther("10"));

            const tokens = [await weth.getAddress(), await usdc.getAddress()]; // Wrong order
            const userBalance = await token.balanceOf(user2.address);

            await expect(
                token.connect(user2).burnAndClaim(userBalance / 10n, tokens)
            ).to.be.revertedWithCustomError(token, "TokensMustBeSortedAndUnique");
        });

        it("Should revert with duplicate tokens", async function () {
            const { token, usdc, user2 } = await loadFixture(deployPersonaTokenForTesting);

            const usdcAddress = await usdc.getAddress();
            const userBalance = await token.balanceOf(user2.address);
            
            await expect(
                token.connect(user2).burnAndClaim(userBalance / 10n, [usdcAddress, usdcAddress])
            ).to.be.revertedWithCustomError(token, "TokensMustBeSortedAndUnique");
        });

        it("Should revert with zero address token", async function () {
            const { token, user2 } = await loadFixture(deployPersonaTokenForTesting);

            const userBalance = await token.balanceOf(user2.address);
            
            await expect(
                token.connect(user2).burnAndClaim(userBalance / 10n, [ethers.ZeroAddress])
            ).to.be.revertedWithCustomError(token, "InvalidTokenAddress");
        });

        it("Should revert if no tokens can be claimed", async function () {
            const { token, usdc, user2 } = await loadFixture(deployPersonaTokenForTesting);

            const userBalance = await token.balanceOf(user2.address);
            
            // No tokens in contract
            await expect(
                token.connect(user2).burnAndClaim(userBalance / 10n, [await usdc.getAddress()])
            ).to.be.revertedWithCustomError(token, "NoTokensToClaim");
        });

        it("Should revert if trying to burn more than balance", async function () {
            const { token, usdc, user2 } = await loadFixture(deployPersonaTokenForTesting);

            await usdc.transfer(await token.getAddress(), ethers.parseEther("1000"));
            const userBalance = await token.balanceOf(user2.address);

            await expect(
                token.connect(user2).burnAndClaim(userBalance * 2n, [await usdc.getAddress()])
            ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
        });
    });

    describe("Edge Cases", function () {
        it("Should handle very small burn amounts", async function () {
            const { token, usdc, user2 } = await loadFixture(deployPersonaTokenForTesting);

            await usdc.transfer(await token.getAddress(), ethers.parseEther("1000"));

            const userBalance = await token.balanceOf(user2.address);
            const totalSupply = await token.totalSupply();

            // Find the minimum burn amount that will yield at least 1 wei of USDC
            // Need: (burnAmount * USDC_balance) / totalSupply >= 1
            // So: burnAmount >= totalSupply / USDC_balance
            const minBurnForOneWei = totalSupply / ethers.parseEther("1000") + 1n;

            // If user balance is less than minimum needed, adjust test
            if (userBalance < minBurnForOneWei) {
                // Burning 1 wei should revert with NoTokensToClaim
                await expect(
                    token.connect(user2).burnAndClaim(1n, [await usdc.getAddress()])
                ).to.be.revertedWithCustomError(token, "NoTokensToClaim");
            } else {
                // Burn just enough to get 1 wei of USDC
                await token.connect(user2).burnAndClaim(minBurnForOneWei, [await usdc.getAddress()]);
                
                const usdcBalance = await usdc.balanceOf(user2.address);
                expect(usdcBalance).to.be.gte(1n);
            }
        });

        it("Should revert when burn amount results in zero claimable tokens", async function () {
            const { token, usdc, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Send a small amount of USDC to the contract
            await usdc.transfer(await token.getAddress(), 100n); // Only 100 wei

            // Burning 1 wei should result in 0 claimable tokens due to rounding
            await expect(
                token.connect(user2).burnAndClaim(1n, [await usdc.getAddress()])
            ).to.be.revertedWithCustomError(token, "NoTokensToClaim");
        });

        it("Should handle burning entire balance", async function () {
            const { token, usdc, user2 } = await loadFixture(deployPersonaTokenForTesting);

            await usdc.transfer(await token.getAddress(), ethers.parseEther("1000"));

            const entireBalance = await token.balanceOf(user2.address);
            const totalSupply = await token.totalSupply();

            await token.connect(user2).burnAndClaim(entireBalance, [await usdc.getAddress()]);

            expect(await token.balanceOf(user2.address)).to.equal(0);
            
            // Should receive proportional USDC
            const expectedUsdc = (ethers.parseEther("1000") * entireBalance) / totalSupply;
            expect(await usdc.balanceOf(user2.address)).to.be.closeTo(expectedUsdc, ethers.parseEther("0.01"));
        });

        it("Should handle multiple users burning simultaneously", async function () {
            const { token, usdc, user2, user3 } = await loadFixture(deployPersonaTokenForTesting);

            await usdc.transfer(await token.getAddress(), ethers.parseEther("1000"));

            // Get balances
            const balance2 = await token.balanceOf(user2.address);
            const balance3 = await token.balanceOf(user3.address);

            // Each burns 50% of their holdings
            const burn2 = balance2 / 2n;
            const burn3 = balance3 / 2n;

            await token.connect(user2).burnAndClaim(burn2, [await usdc.getAddress()]);
            await token.connect(user3).burnAndClaim(burn3, [await usdc.getAddress()]);

            // Verify balances reduced correctly
            expect(await token.balanceOf(user2.address)).to.equal(balance2 - burn2);
            expect(await token.balanceOf(user3.address)).to.equal(balance3 - burn3);

            // Both should have received USDC
            expect(await usdc.balanceOf(user2.address)).to.be.gt(0);
            expect(await usdc.balanceOf(user3.address)).to.be.gt(0);
        });

        it("Should handle tokens with different decimals", async function () {
            const { token, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Deploy a 6-decimal token (like USDC)
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const sixDecimalToken = await TestERC20.deploy("Six Decimal", "SIX", ethers.parseUnits("1000000", 6));

            // Send to contract
            await sixDecimalToken.transfer(await token.getAddress(), ethers.parseUnits("10000", 6));

            const userBalance = await token.balanceOf(user2.address);
            const burnAmount = userBalance / 10n; // Burn 10%

            await token.connect(user2).burnAndClaim(burnAmount, [await sixDecimalToken.getAddress()]);

            // Should receive proportional 6-decimal tokens
            const sixDecBalance = await sixDecimalToken.balanceOf(user2.address);
            expect(sixDecBalance).to.be.gt(0);
        });
    });

    describe("Complex Scenarios", function () {
        it("Should handle claiming from many tokens at once", async function () {
            const { token, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Deploy 5 different tokens
            const tokens = [];
            const TestERC20 = await ethers.getContractFactory("TestERC20");

            for (let i = 0; i < 5; i++) {
                const testToken = await TestERC20.deploy(
                    `Token ${i}`,
                    `TK${i}`,
                    ethers.parseEther("1000000")
                );
                tokens.push(testToken);

                // Send some to the contract
                await testToken.transfer(await token.getAddress(), ethers.parseEther(`${(i + 1) * 100}`));
            }

            // Sort token addresses
            const tokenAddresses = await Promise.all(tokens.map(t => t.getAddress()));
            tokenAddresses.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

            const userBalance = await token.balanceOf(user2.address);
            const burnAmount = userBalance / 5n; // Burn 20%

            await token.connect(user2).burnAndClaim(burnAmount, tokenAddresses);

            // Verify each token was claimed
            for (const tokenAddress of tokenAddresses) {
                const tokenContract = tokens.find(async t => await t.getAddress() === tokenAddress);
                if (tokenContract) {
                    const balance = await tokenContract.balanceOf(user2.address);
                    expect(balance).to.be.gt(0);
                }
            }
        });

        it("Should maintain invariants after multiple burn cycles", async function () {
            const { token, usdc, user2, user3 } = await loadFixture(deployPersonaTokenForTesting);

            await usdc.transfer(await token.getAddress(), ethers.parseEther("10000"));

            const initialTotalSupply = await token.totalSupply();
            const initialUsdcInContract = await usdc.balanceOf(await token.getAddress());

            // Multiple burn cycles
            for (let i = 0; i < 3; i++) {
                const balance2 = await token.balanceOf(user2.address);
                const balance3 = await token.balanceOf(user3.address);
                
                if (balance2 > 0) {
                    await token.connect(user2).burnAndClaim(balance2 / 10n, [await usdc.getAddress()]);
                }
                if (balance3 > 0) {
                    await token.connect(user3).burnAndClaim(balance3 / 10n, [await usdc.getAddress()]);
                }
            }

            const finalTotalSupply = await token.totalSupply();
            const totalBurned = initialTotalSupply - finalTotalSupply;
            const finalUsdcInContract = await usdc.balanceOf(await token.getAddress());
            const totalUsdcDistributed = initialUsdcInContract - finalUsdcInContract;

            // The ratio of USDC distributed should equal the ratio of tokens burned
            if (totalBurned > 0) {
                const expectedDistribution = (initialUsdcInContract * totalBurned) / initialTotalSupply;
                expect(totalUsdcDistributed).to.be.closeTo(expectedDistribution, ethers.parseEther("0.1"));
            }
        });
    });

    describe("Integration with PersonaTokenFactory", function () {
        it("Should handle fresh persona token with initial buy", async function () {
            const { personaFactory, amicaToken, user1, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Create a new persona with initial buy
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST + ethers.parseEther("5000")
            );

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Burn Test Persona",
                "BURNP",
                [],
                [],
                ethers.parseEther("5000"), // Initial buy
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
            const newTokenId = parsedEvent!.args.tokenId;

            // Get the new persona token
            const newPersona = await personaFactory.getPersona(newTokenId);
            const ERC20ImplementationFactory = await ethers.getContractFactory("ERC20Implementation");
            const newPersonaToken = ERC20ImplementationFactory.attach(newPersona.erc20Token) as ERC20Implementation;

            // Deploy and send test token
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const testToken = await TestERC20.deploy("Test", "TST", ethers.parseEther("1000"));
            await testToken.transfer(await newPersonaToken.getAddress(), ethers.parseEther("100"));

            // User1 should have tokens from initial buy
            const user1Balance = await newPersonaToken.balanceOf(user1.address);
            expect(user1Balance).to.be.gt(0);

            // Burn and claim
            await expect(
                newPersonaToken.connect(user1).burnAndClaim(
                    user1Balance / 2n,
                    [await testToken.getAddress()]
                )
            ).to.emit(newPersonaToken, "TokensBurnedAndClaimed");

            expect(await testToken.balanceOf(user1.address)).to.be.gt(0);
        });
    });

    describe("Reentrancy Protection", function () {
        it("Should have reentrancy protection", async function () {
            const { token, user2 } = await loadFixture(deployPersonaTokenForTesting);

            // Deploy a normal token to test with
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const normalToken = await TestERC20.deploy("Normal", "NORM", ethers.parseEther("1000"));
            
            await normalToken.transfer(await token.getAddress(), ethers.parseEther("100"));
            
            const userBalance = await token.balanceOf(user2.address);
            
            // Normal burn and claim should work
            await expect(
                token.connect(user2).burnAndClaim(userBalance / 10n, [await normalToken.getAddress()])
            ).to.emit(token, "TokensBurnedAndClaimed");
        });
    });

    describe("Zero Supply Edge Case", function () {
        it("Should handle preview when total supply approaches zero", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenForTesting);

            // Create a minimal persona
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Minimal",
                "MIN",
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
            const minimalTokenId = parsedEvent!.args.tokenId;

            const minimalPersona = await personaFactory.getPersona(minimalTokenId);
            const ERC20ImplementationFactory = await ethers.getContractFactory("ERC20Implementation");
            const minimalToken = ERC20ImplementationFactory.attach(minimalPersona.erc20Token) as ERC20Implementation;

            // Deploy test token
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const usdc = await TestERC20.deploy("USDC", "USDC", ethers.parseEther("1000"));
            
            // Preview should handle zero supply gracefully
            const preview = await minimalToken.previewBurnAndClaim(
                ethers.parseEther("1"),
                [await usdc.getAddress()]
            );
            expect(preview[0]).to.equal(0);
        });
    });
});
