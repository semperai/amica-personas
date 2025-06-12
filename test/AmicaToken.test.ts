import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("AmicaToken", function () {
    // Constants
    const TOTAL_SUPPLY = ethers.parseEther("1000000000");
    const PRECISION = ethers.parseEther("1");

    // Fixtures
    async function deployAmicaTokenFixture() {
        const [owner, user1, user2, user3, user4] = await ethers.getSigners();

        const AmicaToken = await ethers.getContractFactory("AmicaToken");
        const amicaToken = await AmicaToken.deploy(owner.address);

        // Transfer some tokens to users for testing
        const userAmount = ethers.parseEther("10000");
        await amicaToken.withdraw(user1.address, userAmount);
        await amicaToken.withdraw(user2.address, userAmount);
        await amicaToken.withdraw(user3.address, userAmount);
        await amicaToken.withdraw(user4.address, userAmount);

        return { amicaToken, owner, user1, user2, user3, user4 };
    }

    async function deployWithTokensFixture() {
        const { amicaToken, owner, user1, user2, user3, user4 } = await loadFixture(deployAmicaTokenFixture);

        // Deploy test ERC20 tokens
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const usdc = await TestERC20.deploy("USD Coin", "USDC", ethers.parseEther("10000000"));
        const weth = await TestERC20.deploy("Wrapped Ether", "WETH", ethers.parseEther("100000"));
        const dai = await TestERC20.deploy("Dai Stablecoin", "DAI", ethers.parseEther("10000000"));

        // Give owner some tokens
        await usdc.transfer(owner.address, ethers.parseEther("1000000"));
        await weth.transfer(owner.address, ethers.parseEther("10000"));
        await dai.transfer(owner.address, ethers.parseEther("1000000"));

        // Give users some tokens too
        await usdc.transfer(user1.address, ethers.parseEther("100000"));
        await weth.transfer(user1.address, ethers.parseEther("1000"));
        await dai.transfer(user1.address, ethers.parseEther("100000"));

        return { amicaToken, usdc, weth, dai, owner, user1, user2, user3, user4 };
    }

    describe("Deployment", function () {
        it("Should set the correct name and symbol", async function () {
            const { amicaToken } = await loadFixture(deployAmicaTokenFixture);

            expect(await amicaToken.name()).to.equal("Amica");
            expect(await amicaToken.symbol()).to.equal("AMICA");
        });

        it("Should mint total supply to contract", async function () {
            const { amicaToken } = await loadFixture(deployAmicaTokenFixture);

            expect(await amicaToken.totalSupply()).to.equal(TOTAL_SUPPLY);

            const contractBalance = await amicaToken.balanceOf(await amicaToken.getAddress());
            const userBalances = ethers.parseEther("40000"); // 4 users * 10000
            expect(contractBalance).to.equal(TOTAL_SUPPLY - userBalances);
        });

        it("Should set the correct owner", async function () {
            const { amicaToken, owner } = await loadFixture(deployAmicaTokenFixture);

            expect(await amicaToken.owner()).to.equal(owner.address);
        });

        it("Should initialize with empty deposited tokens list (except index 0)", async function () {
            const { amicaToken } = await loadFixture(deployAmicaTokenFixture);

            const tokens = await amicaToken.getDepositedTokens();
            expect(tokens.length).to.equal(1);
            expect(tokens[0]).to.equal(ethers.ZeroAddress);
        });

        it("Should calculate initial circulating supply correctly", async function () {
            const { amicaToken } = await loadFixture(deployAmicaTokenFixture);

            const circulatingSupply = await amicaToken.circulatingSupply();
            expect(circulatingSupply).to.equal(ethers.parseEther("40000")); // 4 users * 10000
        });
    });

    describe("Ownership", function () {
        it("Should allow owner to transfer ownership", async function () {
            const { amicaToken, owner, user1 } = await loadFixture(deployAmicaTokenFixture);

            await amicaToken.transferOwnership(user1.address);
            expect(await amicaToken.owner()).to.equal(user1.address);
        });

        it("Should reject ownership transfer by non-owner", async function () {
            const { amicaToken, user1, user2 } = await loadFixture(deployAmicaTokenFixture);

            await expect(
                amicaToken.connect(user1).transferOwnership(user2.address)
            ).to.be.revertedWithCustomError(amicaToken, "OwnableUnauthorizedAccount");
        });

        it("Should allow owner to renounce ownership", async function () {
            const { amicaToken, owner } = await loadFixture(deployAmicaTokenFixture);

            await amicaToken.renounceOwnership();
            expect(await amicaToken.owner()).to.equal(ethers.ZeroAddress);
        });
    });

    describe("Withdraw", function () {
        it("Should allow owner to withdraw any amount up to contract balance", async function () {
            const { amicaToken, owner, user1 } = await loadFixture(deployAmicaTokenFixture);

            const withdrawAmount = ethers.parseEther("5000");
            const initialBalance = await amicaToken.balanceOf(user1.address);

            await expect(amicaToken.withdraw(user1.address, withdrawAmount))
                .to.emit(amicaToken, "TokensWithdrawn")
                .withArgs(user1.address, withdrawAmount);

            expect(await amicaToken.balanceOf(user1.address)).to.equal(initialBalance + withdrawAmount);
        });

        it("Should update circulating supply after withdrawal", async function () {
            const { amicaToken, user1 } = await loadFixture(deployAmicaTokenFixture);

            const initialCirculating = await amicaToken.circulatingSupply();
            const withdrawAmount = ethers.parseEther("5000");

            await amicaToken.withdraw(user1.address, withdrawAmount);

            expect(await amicaToken.circulatingSupply()).to.equal(initialCirculating + withdrawAmount);
        });

        it("Should reject withdrawal exceeding contract balance", async function () {
            const { amicaToken, user1 } = await loadFixture(deployAmicaTokenFixture);

            const contractBalance = await amicaToken.balanceOf(await amicaToken.getAddress());
            const excessAmount = contractBalance + ethers.parseEther("1");

            await expect(
                amicaToken.withdraw(user1.address, excessAmount)
            ).to.be.revertedWith("Insufficient balance");
        });

        it("Should reject withdrawal to zero address", async function () {
            const { amicaToken } = await loadFixture(deployAmicaTokenFixture);

            await expect(
                amicaToken.withdraw(ethers.ZeroAddress, ethers.parseEther("1000"))
            ).to.be.revertedWith("Invalid recipient");
        });

        it("Should reject withdrawal by non-owner", async function () {
            const { amicaToken, user1, user2 } = await loadFixture(deployAmicaTokenFixture);

            await expect(
                amicaToken.connect(user1).withdraw(user2.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(amicaToken, "OwnableUnauthorizedAccount");
        });

        it("Should handle multiple withdrawals correctly", async function () {
            const { amicaToken, user1, user2 } = await loadFixture(deployAmicaTokenFixture);

            await amicaToken.withdraw(user1.address, ethers.parseEther("1000"));
            await amicaToken.withdraw(user2.address, ethers.parseEther("2000"));
            await amicaToken.withdraw(user1.address, ethers.parseEther("500"));

            expect(await amicaToken.balanceOf(user1.address)).to.equal(ethers.parseEther("11500"));
            expect(await amicaToken.balanceOf(user2.address)).to.equal(ethers.parseEther("12000"));
        });
    });

    describe("Token Deposits", function () {
        it("Should allow depositing ERC20 tokens", async function () {
            const { amicaToken, usdc, owner } = await loadFixture(deployWithTokensFixture);

            const depositAmount = ethers.parseEther("1000");
            await usdc.approve(await amicaToken.getAddress(), depositAmount);

            await expect(amicaToken.deposit(await usdc.getAddress(), depositAmount))
                .to.emit(amicaToken, "TokensDeposited")
                .withArgs(owner.address, await usdc.getAddress(), depositAmount);

            expect(await amicaToken.depositedBalances(await usdc.getAddress())).to.equal(depositAmount);
            expect(await amicaToken.tokenIndex(await usdc.getAddress())).to.equal(1);
        });

        it("Should add new tokens to deposited tokens list", async function () {
            const { amicaToken, usdc, weth, dai } = await loadFixture(deployWithTokensFixture);

            // Deposit three different tokens
            await usdc.approve(await amicaToken.getAddress(), ethers.parseEther("1000"));
            await weth.approve(await amicaToken.getAddress(), ethers.parseEther("10"));
            await dai.approve(await amicaToken.getAddress(), ethers.parseEther("5000"));

            await amicaToken.deposit(await usdc.getAddress(), ethers.parseEther("1000"));
            await amicaToken.deposit(await weth.getAddress(), ethers.parseEther("10"));
            await amicaToken.deposit(await dai.getAddress(), ethers.parseEther("5000"));

            const depositedTokens = await amicaToken.getDepositedTokens();
            expect(depositedTokens.length).to.equal(4); // Including index 0
            expect(depositedTokens[1]).to.equal(await usdc.getAddress());
            expect(depositedTokens[2]).to.equal(await weth.getAddress());
            expect(depositedTokens[3]).to.equal(await dai.getAddress());
        });

        it("Should handle multiple deposits of same token", async function () {
            const { amicaToken, usdc, user1 } = await loadFixture(deployWithTokensFixture);

            // First deposit
            await usdc.approve(await amicaToken.getAddress(), ethers.parseEther("1000"));
            await amicaToken.deposit(await usdc.getAddress(), ethers.parseEther("1000"));

            // Second deposit from same user
            await usdc.approve(await amicaToken.getAddress(), ethers.parseEther("500"));
            await amicaToken.deposit(await usdc.getAddress(), ethers.parseEther("500"));

            // Third deposit from different user
            await usdc.connect(user1).approve(await amicaToken.getAddress(), ethers.parseEther("2000"));
            await amicaToken.connect(user1).deposit(await usdc.getAddress(), ethers.parseEther("2000"));

            expect(await amicaToken.depositedBalances(await usdc.getAddress())).to.equal(ethers.parseEther("3500"));
            expect(await amicaToken.tokenIndex(await usdc.getAddress())).to.equal(1); // Should not change

            // Should not add duplicate tokens to list
            const depositedTokens = await amicaToken.getDepositedTokens();
            expect(depositedTokens.length).to.equal(2); // Only index 0 and USDC
        });

        it("Should reject zero amount deposits", async function () {
            const { amicaToken, usdc } = await loadFixture(deployWithTokensFixture);

            await expect(
                amicaToken.deposit(await usdc.getAddress(), 0)
            ).to.be.revertedWith("Invalid amount");
        });

        it("Should reject deposits of zero address", async function () {
            const { amicaToken } = await loadFixture(deployWithTokensFixture);

            await expect(
                amicaToken.deposit(ethers.ZeroAddress, ethers.parseEther("1000"))
            ).to.be.revertedWith("Invalid token");
        });

        it("Should reject deposits without approval", async function () {
            const { amicaToken, usdc } = await loadFixture(deployWithTokensFixture);

            await expect(
                amicaToken.deposit(await usdc.getAddress(), ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(usdc, "ERC20InsufficientAllowance");
        });

        it("Should handle deposits of tokens with different decimals", async function () {
            const { amicaToken } = await loadFixture(deployWithTokensFixture);

            // Deploy a 6-decimal token (like USDC on mainnet)
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const sixDecimalToken = await TestERC20.deploy("Six Decimal", "SIX", ethers.parseUnits("1000000", 6));

            const depositAmount = ethers.parseUnits("1000", 6);
            await sixDecimalToken.approve(await amicaToken.getAddress(), depositAmount);
            await amicaToken.deposit(await sixDecimalToken.getAddress(), depositAmount);

            expect(await amicaToken.depositedBalances(await sixDecimalToken.getAddress())).to.equal(depositAmount);
        });
    });

    describe("Burn and Claim", function () {
        async function setupDepositsFixture() {
            const { amicaToken, usdc, weth, dai, owner, user1, user2, user3, user4 } = await loadFixture(deployWithTokensFixture);

            // Deposit various amounts of tokens
            await usdc.approve(await amicaToken.getAddress(), ethers.parseEther("100000"));
            await weth.approve(await amicaToken.getAddress(), ethers.parseEther("1000"));
            await dai.approve(await amicaToken.getAddress(), ethers.parseEther("500000"));

            await amicaToken.deposit(await usdc.getAddress(), ethers.parseEther("100000"));
            await amicaToken.deposit(await weth.getAddress(), ethers.parseEther("1000"));
            await amicaToken.deposit(await dai.getAddress(), ethers.parseEther("500000"));

            return { amicaToken, usdc, weth, dai, owner, user1, user2, user3, user4 };
        }

        it("Should burn tokens and claim proportional deposited tokens", async function () {
            const { amicaToken, usdc, weth, dai, user1 } = await loadFixture(setupDepositsFixture);

            const userBalance = await amicaToken.balanceOf(user1.address);
            const burnAmount = ethers.parseEther("1000"); // 10% of user's balance
            const circulatingSupply = await amicaToken.circulatingSupply();

            // Calculate expected amounts
            const sharePercentage = (burnAmount * PRECISION) / circulatingSupply;
            const expectedUsdc = (ethers.parseEther("100000") * sharePercentage) / PRECISION;
            const expectedWeth = (ethers.parseEther("1000") * sharePercentage) / PRECISION;
            const expectedDai = (ethers.parseEther("500000") * sharePercentage) / PRECISION;

            await expect(amicaToken.connect(user1).burnAndClaim(burnAmount, [1, 2, 3]))
                .to.emit(amicaToken, "TokensBurnedAndClaimed");

            // Check token balances
            expect(await usdc.balanceOf(user1.address)).to.be.closeTo(
                ethers.parseEther("100000") + expectedUsdc,
                ethers.parseEther("0.01")
            );
            expect(await weth.balanceOf(user1.address)).to.be.closeTo(
                ethers.parseEther("1000") + expectedWeth,
                ethers.parseEther("0.001")
            );
            expect(await dai.balanceOf(user1.address)).to.be.closeTo(
                ethers.parseEther("100000") + expectedDai,
                ethers.parseEther("0.01")
            );

            // Check AMICA balance
            expect(await amicaToken.balanceOf(user1.address)).to.equal(userBalance - burnAmount);

            // Check updated deposited balances
            expect(await amicaToken.depositedBalances(await usdc.getAddress())).to.be.closeTo(
                ethers.parseEther("100000") - expectedUsdc,
                ethers.parseEther("0.01")
            );
        });

        it("Should handle claiming from specific tokens only", async function () {
            const { amicaToken, usdc, weth, dai, user1 } = await loadFixture(setupDepositsFixture);

            const burnAmount = ethers.parseEther("500");
            const initialUsdcBalance = await usdc.balanceOf(user1.address);
            const initialWethBalance = await weth.balanceOf(user1.address);
            const initialDaiBalance = await dai.balanceOf(user1.address);

            // Only claim USDC and WETH (indices 1 and 2)
            await amicaToken.connect(user1).burnAndClaim(burnAmount, [1, 2]);

            // Should receive USDC and WETH
            expect(await usdc.balanceOf(user1.address)).to.be.gt(initialUsdcBalance);
            expect(await weth.balanceOf(user1.address)).to.be.gt(initialWethBalance);

            // Should NOT receive DAI
            expect(await dai.balanceOf(user1.address)).to.equal(initialDaiBalance);
        });

        it("Should handle claiming with no deposited balance for a token", async function () {
            const { amicaToken, user1 } = await loadFixture(deployWithTokensFixture);

            // Deploy a new token but don't deposit it
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const emptyToken = await TestERC20.deploy("Empty", "EMPTY", ethers.parseEther("1000"));

            // Force add it to the token list
            await emptyToken.approve(await amicaToken.getAddress(), 1);
            await amicaToken.deposit(await emptyToken.getAddress(), 1);

            // Withdraw the 1 token to make balance 0
            await amicaToken.recoverToken(await emptyToken.getAddress(), await amicaToken.owner());

            // Try to claim including this empty token
            const tokenIndex = await amicaToken.tokenIndex(await emptyToken.getAddress());
            await expect(
                amicaToken.connect(user1).burnAndClaim(ethers.parseEther("100"), [tokenIndex])
            ).to.be.revertedWith("No tokens to claim");
        });

        it("Should handle multiple users claiming concurrently", async function () {
            const { amicaToken, usdc, user1, user2, user3 } = await loadFixture(setupDepositsFixture);

            const burnAmount = ethers.parseEther("500");

            // All users claim at once
            const tx1 = amicaToken.connect(user1).burnAndClaim(burnAmount, [1]);
            const tx2 = amicaToken.connect(user2).burnAndClaim(burnAmount, [1]);
            const tx3 = amicaToken.connect(user3).burnAndClaim(burnAmount, [1]);

            await Promise.all([tx1, tx2, tx3]);

            // All should have received tokens
            expect(await usdc.balanceOf(user1.address)).to.be.gt(ethers.parseEther("100000"));
            expect(await usdc.balanceOf(user2.address)).to.be.gt(0);
            expect(await usdc.balanceOf(user3.address)).to.be.gt(0);
        });

        it("Should properly update circulating supply after burn", async function () {
            const { amicaToken, user1 } = await loadFixture(setupDepositsFixture);

            const initialCirculating = await amicaToken.circulatingSupply();
            const burnAmount = ethers.parseEther("1000");

            await amicaToken.connect(user1).burnAndClaim(burnAmount, [1]);

            expect(await amicaToken.circulatingSupply()).to.equal(initialCirculating - burnAmount);
        });

        it("Should reject burn with no tokens selected", async function () {
            const { amicaToken, user1 } = await loadFixture(setupDepositsFixture);

            await expect(
                amicaToken.connect(user1).burnAndClaim(ethers.parseEther("1000"), [])
            ).to.be.revertedWith("No tokens selected");
        });

        it("Should reject burn with zero amount", async function () {
            const { amicaToken, user1 } = await loadFixture(setupDepositsFixture);

            await expect(
                amicaToken.connect(user1).burnAndClaim(0, [1])
            ).to.be.revertedWith("Invalid burn amount");
        });

        it("Should reject burn exceeding user balance", async function () {
            const { amicaToken, user1 } = await loadFixture(setupDepositsFixture);

            const userBalance = await amicaToken.balanceOf(user1.address);

            await expect(
                amicaToken.connect(user1).burnAndClaim(userBalance + 1n, [1])
            ).to.be.revertedWithCustomError(amicaToken, "ERC20InsufficientBalance");
        });

        it("Should reject invalid token index", async function () {
            const { amicaToken, user1 } = await loadFixture(setupDepositsFixture);

            await expect(
                amicaToken.connect(user1).burnAndClaim(ethers.parseEther("1000"), [999])
            ).to.be.revertedWith("Invalid token index");
        });

        it("Should handle claiming when circulating supply is very low", async function () {
            const { amicaToken, usdc, user1, user2, user3, user4 } = await loadFixture(setupDepositsFixture);

            // Withdraw most tokens back to contract
            const user2Balance = await amicaToken.balanceOf(await user2.getAddress());
            const user3Balance = await amicaToken.balanceOf(await user3.getAddress());
            const user4Balance = await amicaToken.balanceOf(await user4.getAddress());

            await amicaToken.connect(user2).transfer(await amicaToken.getAddress(), user2Balance);
            await amicaToken.connect(user3).transfer(await amicaToken.getAddress(), user3Balance);
            await amicaToken.connect(user4).transfer(await amicaToken.getAddress(), user4Balance);

            // Now circulating supply is very low
            const lowCirculating = await amicaToken.circulatingSupply();
            expect(lowCirculating).to.equal(ethers.parseEther("20000")); // Only user1 and owner have tokens

            // User1 burns half their tokens
            const burnAmount = ethers.parseEther("5000");
            await amicaToken.connect(user1).burnAndClaim(burnAmount, [1]);

            // Should receive 25% of deposited USDC (5000/20000)
            expect(await usdc.balanceOf(user1.address)).to.be.closeTo(
                ethers.parseEther("100000") + ethers.parseEther("25000"),
                ethers.parseEther("1")
            );
        });

        it("Should emit correct event data", async function () {
            const { amicaToken, usdc, weth, user1 } = await loadFixture(setupDepositsFixture);

            const burnAmount = ethers.parseEther("1000");
            const circulatingSupply = await amicaToken.circulatingSupply();
            const sharePercentage = (burnAmount * PRECISION) / circulatingSupply;

            const usdcExpected = (ethers.parseEther("100000") * sharePercentage) / PRECISION;
            const wethExpected = (ethers.parseEther("1000") * sharePercentage) / PRECISION;

            const tx = await amicaToken.connect(user1).burnAndClaim(burnAmount, [1, 2]);
            const receipt = await tx.wait();

            // Find the event
            const event = receipt?.logs.find(
                log => log.topics[0] === amicaToken.interface.getEvent('TokensBurnedAndClaimed').topicHash
            );

            expect(event).to.not.be.undefined;

            const decodedEvent = amicaToken.interface.decodeEventLog(
                'TokensBurnedAndClaimed',
                event!.data,
                event!.topics
            );

            expect(decodedEvent.user).to.equal(user1.address);
            expect(decodedEvent.amountBurned).to.equal(burnAmount);
            expect(decodedEvent.tokens).to.deep.equal([await usdc.getAddress(), await weth.getAddress()]);
            expect(decodedEvent.amounts[0]).to.be.closeTo(usdcExpected, ethers.parseEther("0.01"));
            expect(decodedEvent.amounts[1]).to.be.closeTo(wethExpected, ethers.parseEther("0.001"));
        });
    });

    describe("Token Recovery", function () {
        it("Should recover accidentally sent tokens", async function () {
            const { amicaToken, usdc, owner } = await loadFixture(deployWithTokensFixture);

            // Send tokens directly to contract (simulating accidental transfer)
            const accidentalAmount = ethers.parseEther("5000");
            await usdc.transfer(await amicaToken.getAddress(), accidentalAmount);

            // Recover tokens
            await expect(amicaToken.recoverToken(await usdc.getAddress(), owner.address))
                .to.emit(amicaToken, "TokensRecovered")
                .withArgs(owner.address, await usdc.getAddress(), accidentalAmount);

            expect(await usdc.balanceOf(owner.address)).to.equal(ethers.parseEther("1000000"));
        });

        it("Should recover partial amount when some tokens are deposited", async function () {
            const { amicaToken, usdc, owner } = await loadFixture(deployWithTokensFixture);

            // First deposit some tokens properly
            const depositAmount = ethers.parseEther("2000");
            await usdc.approve(await amicaToken.getAddress(), depositAmount);
            await amicaToken.deposit(await usdc.getAddress(), depositAmount);

            // Then send some accidentally
            const accidentalAmount = ethers.parseEther("3000");
            await usdc.transfer(await amicaToken.getAddress(), accidentalAmount);

            // Should only recover the accidental amount
            await expect(amicaToken.recoverToken(await usdc.getAddress(), owner.address))
                .to.emit(amicaToken, "TokensRecovered")
                .withArgs(owner.address, await usdc.getAddress(), accidentalAmount);

            // Deposited balance should remain unchanged
            expect(await amicaToken.depositedBalances(await usdc.getAddress())).to.equal(depositAmount);
        });

        it("Should reject recovery when no excess tokens", async function () {
            const { amicaToken, usdc, owner } = await loadFixture(deployWithTokensFixture);

            // Only deposit tokens (no accidental transfer)
            const depositAmount = ethers.parseEther("1000");
            await usdc.approve(await amicaToken.getAddress(), depositAmount);
            await amicaToken.deposit(await usdc.getAddress(), depositAmount);

            await expect(
                amicaToken.recoverToken(await usdc.getAddress(), owner.address)
            ).to.be.revertedWith("No tokens to recover");
        });

        it("Should reject recovery of AMICA tokens", async function () {
            const { amicaToken, owner } = await loadFixture(deployWithTokensFixture);

            await expect(
                amicaToken.recoverToken(await amicaToken.getAddress(), owner.address)
            ).to.be.revertedWith("Cannot recover AMICA");
        });

        it("Should reject recovery to zero address", async function () {
            const { amicaToken, usdc } = await loadFixture(deployWithTokensFixture);

            await usdc.transfer(await amicaToken.getAddress(), ethers.parseEther("1000"));

            await expect(
                amicaToken.recoverToken(await usdc.getAddress(), ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid recipient");
        });

        it("Should reject recovery by non-owner", async function () {
            const { amicaToken, usdc, user1 } = await loadFixture(deployWithTokensFixture);

            await usdc.transfer(await amicaToken.getAddress(), ethers.parseEther("1000"));

            await expect(
                amicaToken.connect(user1).recoverToken(await usdc.getAddress(), user1.address)
            ).to.be.revertedWithCustomError(amicaToken, "OwnableUnauthorizedAccount");
        });
    });
});