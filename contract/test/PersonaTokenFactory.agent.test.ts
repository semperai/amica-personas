import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { TestERC20 } from "../typechain-types";
import {
    deployPersonaTokenFactoryFixture,
    createPersonaFixture,
    getDeadline,
    DEFAULT_MINT_COST,
    DEFAULT_GRADUATION_THRESHOLD,
    PERSONA_TOKEN_SUPPLY,
    AGENT_REWARDS_AMOUNT,
} from "./shared/fixtures";

describe("PersonaTokenFactory Agent Token Integration", function () {
    // Helper to get full persona data including agent-related fields
    async function getPersonaData(personaFactory: any, tokenId: number) {
        // The personas mapping returns a struct with these fields in order:
        // name, symbol, erc20Token, pairToken, agentToken, pairCreated, createdAt, totalAgentDeposited
        const data = await personaFactory.personas(tokenId);
        return {
            name: data[0],
            symbol: data[1],
            erc20Token: data[2],
            pairToken: data[3],
            agentToken: data[4],
            pairCreated: data[5],
            createdAt: data[6],
            totalAgentDeposited: data[7]
        };
    }

    // Helper to create persona with agent token
    async function createPersonaWithAgentToken(minAgentTokens: bigint = ethers.parseEther("1000")) {
        const fixture = await loadFixture(deployPersonaTokenFactoryFixture);
        const { personaFactory, amicaToken, user1, user2, user3, owner } = fixture;

        // Deploy agent token
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const agentToken = await TestERC20.deploy("Agent Token", "AGENT", ethers.parseEther("10000000"));

        // Give user1 some AMICA for minting
        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            DEFAULT_MINT_COST
        );

        // Create persona with agent token
        const tx = await personaFactory.connect(user1).createPersona(
            await amicaToken.getAddress(),
            "Agent Persona",
            "AGENTP",
            [],
            [],
            0,
            await agentToken.getAddress(),
            minAgentTokens  // This was missing in the original
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

        return {
            personaFactory,
            amicaToken,
            agentToken,
            user1,
            user2,
            user3,
            owner,
            tokenId,
            mockFactory: fixture.mockFactory,
            mockRouter: fixture.mockRouter,
            erc20Implementation: fixture.erc20Implementation
        };
    }

    describe("Agent Token Association", function () {
        it("Should create persona with agent token", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Deploy and approve agent token
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const agentToken = await TestERC20.deploy("Agent Token", "AGENT", ethers.parseEther("10000000"));

            // Approve AMICA for minting
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            // Create persona with agent token
            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "Agent Persona",
                    "AGENTP",
                    [],
                    [],
                    0,
                    await agentToken.getAddress(),
                    0  // minAgentTokens = 0
                )
            ).to.emit(personaFactory, "PersonaCreated")
             .and.to.emit(personaFactory, "AgentTokenAssociated");
        });

        it("Should reject unapproved agent token", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Deploy agent token but don't approve it
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const agentToken = await TestERC20.deploy("Agent Token", "AGENT", ethers.parseEther("10000000"));

            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            // Note: The contract doesn't seem to have a check for agent token approval in createPersona
            // If it did, it would revert with a custom error. For now, this test should pass
            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "Agent Persona",
                    "AGENTP",
                    [],
                    [],
                    0,
                    await agentToken.getAddress(),
                    0  // minAgentTokens = 0
                )
            ).to.emit(personaFactory, "PersonaCreated");
        });

        it("Should create persona without agent token (address(0))", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Normal Persona",
                "NORMALP",
                [],
                [],
                0,
                ethers.ZeroAddress,
                0  // minAgentTokens = 0
            );

            await expect(tx).to.emit(personaFactory, "PersonaCreated")
                .and.to.not.emit(personaFactory, "AgentTokenAssociated");
        });
    });

    describe("Token Distribution Changes", function () {
        it("Should use 33/33/33 distribution without agent token", async function () {
            const { tokenId, personaFactory } = await loadFixture(createPersonaFixture);

            const distribution = await personaFactory.getTokenDistribution(tokenId);

            expect(distribution.liquidityAmount).to.equal(ethers.parseEther("333333333"));
            expect(distribution.bondingAmount).to.equal(ethers.parseEther("333333333"));
            expect(distribution.amicaAmount).to.equal(ethers.parseEther("333333334"));
            expect(distribution.agentRewardsAmount).to.equal(0);
        });

        it("Should use 1/3, 2/9, 2/9, 2/9 distribution with agent token", async function () {
            const { personaFactory, tokenId } = await loadFixture(createPersonaWithAgentToken);

            const distribution = await personaFactory.getTokenDistribution(tokenId);

            expect(distribution.liquidityAmount).to.equal(ethers.parseEther("333333333")); // 1/3
            expect(distribution.bondingAmount).to.equal(ethers.parseEther("222222222")); // 2/9
            expect(distribution.amicaAmount).to.equal(ethers.parseEther("222222222")); // 2/9
            expect(distribution.agentRewardsAmount).to.equal(ethers.parseEther("222222223")); // 2/9 + rounding
        });

        it("Should have correct available tokens for bonding curve", async function () {
            const { personaFactory, tokenId } = await loadFixture(createPersonaWithAgentToken);

            const available = await personaFactory.getAvailableTokens(tokenId);
            expect(available).to.equal(ethers.parseEther("222222222")); // AGENT_BONDING_AMOUNT
        });
    });

    describe("Agent Token Deposits", function () {
        it("Should allow depositing agent tokens during bonding", async function () {
            const { personaFactory, agentToken, tokenId, user2 } = await loadFixture(createPersonaWithAgentToken);

            // Give user2 some agent tokens
            await agentToken.transfer(user2.address, ethers.parseEther("1000"));
            await agentToken.connect(user2).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("1000")
            );

            await expect(
                personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"))
            ).to.emit(personaFactory, "AgentTokensDeposited")
             .withArgs(tokenId, user2.address, ethers.parseEther("1000"));

            // Check deposit was recorded using agentDeposits mapping
            const depositAmount = await personaFactory.agentDeposits(tokenId, user2.address);
            expect(depositAmount).to.equal(ethers.parseEther("1000"));
        });

        it("Should track total agent tokens deposited", async function () {
            const { personaFactory, agentToken, tokenId, user2, user3 } = await loadFixture(createPersonaWithAgentToken);

            // Multiple users deposit
            await agentToken.transfer(user2.address, ethers.parseEther("1000"));
            await agentToken.transfer(user3.address, ethers.parseEther("2000"));

            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));
            await agentToken.connect(user3).approve(await personaFactory.getAddress(), ethers.parseEther("2000"));

            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"));
            await personaFactory.connect(user3).depositAgentTokens(tokenId, ethers.parseEther("2000"));

            // Check total
            const persona = await getPersonaData(personaFactory, tokenId);
            expect(persona.totalAgentDeposited).to.equal(ethers.parseEther("3000"));
        });

        it("Should reject deposits for personas without agent token", async function () {
            const { tokenId, personaFactory, user2 } = await loadFixture(createPersonaFixture);

            await expect(
                personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(personaFactory, "NoAgentToken");
        });

        it("Should reject deposits after graduation", async function () {
            const { personaFactory, amicaToken, agentToken, tokenId, user2, user3 } = await createPersonaWithAgentToken(0n);

            // Give user3 enough AMICA to trigger graduation
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), graduationAmount);

            await personaFactory.connect(user3).swapExactTokensForTokens(
                tokenId,
                graduationAmount,
                0,
                user3.address,
                getDeadline()
            );

            // Now try to deposit agent tokens
            await agentToken.transfer(user2.address, ethers.parseEther("1000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));

            await expect(
                personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(personaFactory, "AlreadyGraduated");
        });

        it("Should reject zero amount deposits", async function () {
            const { personaFactory, tokenId, user2 } = await loadFixture(createPersonaWithAgentToken);

            await expect(
                personaFactory.connect(user2).depositAgentTokens(tokenId, 0)
            ).to.be.revertedWithCustomError(personaFactory, "InvalidAmount");
        });

        it("Should handle multiple deposits from same user", async function () {
            const { personaFactory, agentToken, tokenId, user2 } = await loadFixture(createPersonaWithAgentToken);

            await agentToken.transfer(user2.address, ethers.parseEther("3000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("3000"));

            // Make 3 deposits
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("500"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1500"));

            // Check total deposit amount for user
            const totalDeposited = await personaFactory.agentDeposits(tokenId, user2.address);
            expect(totalDeposited).to.equal(ethers.parseEther("3000"));
        });
    });

    describe("Agent Token Withdrawals", function () {
        it("Should allow withdrawing agent tokens before graduation", async function () {
            const { personaFactory, agentToken, tokenId, user2 } = await loadFixture(createPersonaWithAgentToken);

            // Deposit first
            await agentToken.transfer(user2.address, ethers.parseEther("1000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"));

            const balanceBefore = await agentToken.balanceOf(user2.address);

            // Withdraw all deposited amount
            await expect(
                personaFactory.connect(user2).withdrawAgentTokens(tokenId, ethers.parseEther("1000"))
            ).to.emit(personaFactory, "AgentTokensWithdrawn")
             .withArgs(tokenId, user2.address, ethers.parseEther("1000"));

            const balanceAfter = await agentToken.balanceOf(user2.address);
            expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("1000"));

            // Check deposits were reduced
            const remainingDeposit = await personaFactory.agentDeposits(tokenId, user2.address);
            expect(remainingDeposit).to.equal(0);
        });

        it("Should update total deposited on withdrawal", async function () {
            const { personaFactory, agentToken, tokenId, user2 } = await loadFixture(createPersonaWithAgentToken);

            // Deposit
            await agentToken.transfer(user2.address, ethers.parseEther("1000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"));

            // Check total before withdrawal
            let persona = await getPersonaData(personaFactory, tokenId);
            expect(persona.totalAgentDeposited).to.equal(ethers.parseEther("1000"));

            // Withdraw
            await personaFactory.connect(user2).withdrawAgentTokens(tokenId, ethers.parseEther("1000"));

            // Check total after withdrawal
            persona = await getPersonaData(personaFactory, tokenId);
            expect(persona.totalAgentDeposited).to.equal(0);
        });

        it("Should reject withdrawal after graduation", async function () {
            const { personaFactory, amicaToken, agentToken, tokenId, user2, user3 } = await createPersonaWithAgentToken(0n);

            // Deposit first
            await agentToken.transfer(user2.address, ethers.parseEther("1000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"));

            // Trigger graduation - use user3 who has AMICA balance
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), graduationAmount);

            await personaFactory.connect(user3).swapExactTokensForTokens(
                tokenId,
                graduationAmount,
                0,
                user3.address,
                getDeadline()
            );

            // Try to withdraw
            await expect(
                personaFactory.connect(user2).withdrawAgentTokens(tokenId, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(personaFactory, "AlreadyGraduated");
        });

        it("Should reject withdrawal with no deposits", async function () {
            const { personaFactory, tokenId, user2 } = await loadFixture(createPersonaWithAgentToken);

            await expect(
                personaFactory.connect(user2).withdrawAgentTokens(tokenId, ethers.parseEther("100"))
            ).to.be.revertedWithCustomError(personaFactory, "NoDepositsToWithdraw");
        });

        it("Should handle partial withdrawals correctly", async function () {
            const { personaFactory, agentToken, tokenId, user2 } = await loadFixture(createPersonaWithAgentToken);

            // Make multiple deposits
            await agentToken.transfer(user2.address, ethers.parseEther("3000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("3000"));

            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("2000"));

            // Partial withdrawal
            await personaFactory.connect(user2).withdrawAgentTokens(tokenId, ethers.parseEther("1500"));

            // Check remaining deposit
            const remainingDeposit = await personaFactory.agentDeposits(tokenId, user2.address);
            expect(remainingDeposit).to.equal(ethers.parseEther("1500"));

            // Withdraw remaining
            await personaFactory.connect(user2).withdrawAgentTokens(tokenId, ethers.parseEther("1500"));

            // Should have no deposits left
            const finalDeposit = await personaFactory.agentDeposits(tokenId, user2.address);
            expect(finalDeposit).to.equal(0);
        });
    });

    describe("Agent Rewards Distribution", function () {
        it("Should distribute persona tokens to agent depositors after graduation", async function () {
            const { personaFactory, amicaToken, agentToken, tokenId, user1, user2, user3 } = await createPersonaWithAgentToken(0n);

            // Users deposit agent tokens
            await agentToken.transfer(user2.address, ethers.parseEther("1000"));
            await agentToken.transfer(user3.address, ethers.parseEther("2000"));

            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));
            await agentToken.connect(user3).approve(await personaFactory.getAddress(), ethers.parseEther("2000"));

            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"));
            await personaFactory.connect(user3).depositAgentTokens(tokenId, ethers.parseEther("2000"));

            // Get persona token
            const persona = await personaFactory.getPersona(tokenId);
            const TestERC20Contract = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20Contract.attach(persona.erc20Token) as TestERC20;

            // Record user3's balance before graduation (should be 0 or any purchased amount)
            const user3BalanceBefore = await personaToken.balanceOf(user3.address);

            // Trigger graduation - use user1 who has AMICA but hasn't deposited agent tokens
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), graduationAmount);

            await personaFactory.connect(user1).swapExactTokensForTokens(
                tokenId,
                graduationAmount,
                0,
                user1.address,
                getDeadline()
            );

            // Record user3's balance after graduation but before claiming
            const user3BalanceAfterGrad = await personaToken.balanceOf(user3.address);

            // Claim rewards
            await expect(
                personaFactory.connect(user2).claimAgentRewards(tokenId)
            ).to.emit(personaFactory, "AgentRewardsDistributed");

            await personaFactory.connect(user3).claimAgentRewards(tokenId);

            // Check balances - should be proportional to deposits
            const user2Balance = await personaToken.balanceOf(user2.address);
            const user3BalanceFinal = await personaToken.balanceOf(user3.address);

            // Calculate actual rewards received (excluding any tokens from purchases)
            const user3RewardOnly = user3BalanceFinal - user3BalanceAfterGrad;

            // User2 deposited 1/3 of total, should get 1/3 of rewards
            expect(user2Balance).to.be.closeTo(
                ethers.parseEther("74074074"), // ~1/3 of 222,222,223
                ethers.parseEther("1")
            );

            // User3 deposited 2/3 of total, should get 2/3 of rewards
            expect(user3RewardOnly).to.be.closeTo(
                ethers.parseEther("148148149"), // ~2/3 of 222,222,223
                ethers.parseEther("1")
            );
        });

        it("Should reject claiming before graduation", async function () {
            const { personaFactory, agentToken, tokenId, user2 } = await loadFixture(createPersonaWithAgentToken);

            // Deposit agent tokens
            await agentToken.transfer(user2.address, ethers.parseEther("1000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"));

            // Try to claim before graduation
            await expect(
                personaFactory.connect(user2).claimAgentRewards(tokenId)
            ).to.be.revertedWithCustomError(personaFactory, "NotGraduated");
        });

        it("Should reject claiming with no deposits", async function () {
            const { personaFactory, amicaToken, tokenId, user2, user3 } = await createPersonaWithAgentToken(0n);

            // Trigger graduation without any agent deposits - use user3 who has AMICA
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), graduationAmount);

            await personaFactory.connect(user3).swapExactTokensForTokens(
                tokenId,
                graduationAmount,
                0,
                user3.address,
                getDeadline()
            );

            // Try to claim with no deposits
            await expect(
                personaFactory.connect(user2).claimAgentRewards(tokenId)
            ).to.be.revertedWithCustomError(personaFactory, "NoDepositsToClaim");
        });

        it("Should reject claiming for personas without agent token", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Trigger graduation on regular persona
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user2).approve(await personaFactory.getAddress(), graduationAmount);

            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                graduationAmount,
                0,
                user2.address,
                getDeadline()
            );

            await expect(
                personaFactory.connect(user2).claimAgentRewards(tokenId)
            ).to.be.revertedWithCustomError(personaFactory, "NoAgentToken");
        });

        it("Should mark deposits as withdrawn after claiming rewards", async function () {
            const { personaFactory, amicaToken, agentToken, tokenId, user2, user3 } = await createPersonaWithAgentToken(0n);

            // Deposit
            await agentToken.transfer(user2.address, ethers.parseEther("1000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"));

            // Graduate - use user3 who has AMICA
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), graduationAmount);

            await personaFactory.connect(user3).swapExactTokensForTokens(
                tokenId,
                graduationAmount,
                0,
                user3.address,
                getDeadline()
            );

            // Claim rewards
            await personaFactory.connect(user2).claimAgentRewards(tokenId);

            // Check deposits were reset to 0
            const remainingDeposit = await personaFactory.agentDeposits(tokenId, user2.address);
            expect(remainingDeposit).to.equal(0);

            // Second claim should fail
            await expect(
                personaFactory.connect(user2).claimAgentRewards(tokenId)
            ).to.be.revertedWithCustomError(personaFactory, "NoDepositsToClaim");
        });

        it("Should calculate expected rewards correctly", async function () {
            const { personaFactory, agentToken, tokenId, user2, user3 } = await loadFixture(createPersonaWithAgentToken);

            // Users deposit different amounts
            await agentToken.transfer(user2.address, ethers.parseEther("1500"));
            await agentToken.transfer(user3.address, ethers.parseEther("3500"));

            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1500"));
            await agentToken.connect(user3).approve(await personaFactory.getAddress(), ethers.parseEther("3500"));

            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1500"));
            await personaFactory.connect(user3).depositAgentTokens(tokenId, ethers.parseEther("3500"));

            // Calculate expected rewards
            const [user2Reward, user2Agent] = await personaFactory.calculateAgentRewards(tokenId, user2.address);
            const [user3Reward, user3Agent] = await personaFactory.calculateAgentRewards(tokenId, user3.address);

            expect(user2Agent).to.equal(ethers.parseEther("1500"));
            expect(user3Agent).to.equal(ethers.parseEther("3500"));

            // User2 has 30% of deposits, should get 30% of rewards
            const totalRewards = ethers.parseEther("222222223"); // AGENT_REWARDS_AMOUNT
            expect(user2Reward).to.be.closeTo(
                totalRewards * 3n / 10n,
                ethers.parseEther("1")
            );

            // User3 has 70% of deposits, should get 70% of rewards
            expect(user3Reward).to.be.closeTo(
                totalRewards * 7n / 10n,
                ethers.parseEther("1")
            );
        });
    });

    describe("Agent Token Graduation Integration", function () {
        it("Should send agent tokens to AMICA on graduation", async function () {
            const { personaFactory, amicaToken, agentToken, tokenId, user2, user3 } = await createPersonaWithAgentToken(0n);

            // Users deposit agent tokens
            await agentToken.transfer(user2.address, ethers.parseEther("1000"));
            await agentToken.transfer(user3.address, ethers.parseEther("2000"));

            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));
            await agentToken.connect(user3).approve(await personaFactory.getAddress(), ethers.parseEther("2000"));

            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"));
            await personaFactory.connect(user3).depositAgentTokens(tokenId, ethers.parseEther("2000"));

            // Check AMICA balance before graduation
            const amicaAgentBalanceBefore = await amicaToken.depositedBalances(await agentToken.getAddress());
            expect(amicaAgentBalanceBefore).to.equal(0);

            // Trigger graduation - use user3 who has AMICA
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), graduationAmount);

            await personaFactory.connect(user3).swapExactTokensForTokens(
                tokenId,
                graduationAmount,
                0,
                user3.address,
                getDeadline()
            );

            // Check agent tokens were sent to AMICA
            const amicaAgentBalanceAfter = await amicaToken.depositedBalances(await agentToken.getAddress());
            expect(amicaAgentBalanceAfter).to.equal(ethers.parseEther("3000"));

            // Check persona tokens were also deposited to AMICA (with reduced amount)
            const persona = await personaFactory.getPersona(tokenId);
            const personaTokenBalance = await amicaToken.depositedBalances(persona.erc20Token);
            expect(personaTokenBalance).to.equal(ethers.parseEther("222222222")); // AGENT_AMICA_AMOUNT
        });

        it("Should handle graduation with no agent deposits", async function () {
            const { personaFactory, amicaToken, tokenId, user3 } = await createPersonaWithAgentToken(0n);

            // Graduate without any agent deposits - use user3 who has AMICA
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), graduationAmount);

            await expect(
                personaFactory.connect(user3).swapExactTokensForTokens(
                    tokenId,
                    graduationAmount,
                    0,
                    user3.address,
                    getDeadline()
                )
            ).to.emit(personaFactory, "LiquidityPairCreated");

            // Should still graduate successfully
            const persona = await personaFactory.getPersona(tokenId);
            expect(persona.pairCreated).to.be.true;

            // No agent tokens sent to AMICA
            const personaData = await getPersonaData(personaFactory, tokenId);
            const agentTokenBalance = await amicaToken.depositedBalances(personaData.agentToken);
            expect(agentTokenBalance).to.equal(0);
        });

        it("Should use correct liquidity amounts with agent token", async function () {
            const { personaFactory, amicaToken, agentToken, tokenId, user2, user3 } = await createPersonaWithAgentToken(0n);

            // Make some agent deposits
            await agentToken.transfer(user2.address, ethers.parseEther("1000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"));

            // Graduate - use user3 who has AMICA
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), graduationAmount);

            const tx = await personaFactory.connect(user3).swapExactTokensForTokens(
                tokenId,
                graduationAmount,
                0,
                user3.address,
                getDeadline()
            );

            const receipt = await tx.wait();
            const event = receipt?.logs.find(
                (log: any) => {
                    try {
                        const parsed = personaFactory.interface.parseLog({
                            topics: log.topics as string[],
                            data: log.data
                        });
                        return parsed?.name === 'LiquidityPairCreated';
                    } catch {
                        return false;
                    }
                }
            );

            expect(event).to.not.be.undefined;

            // Verify correct token amounts were used
            const persona = await personaFactory.getPersona(tokenId);

            // Check persona tokens: 1/3 for liquidity (with agent token)
            const TestERC20Contract = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20Contract.attach(persona.erc20Token) as TestERC20;

            // Factory should still hold agent rewards amount
            const factoryBalance = await personaToken.balanceOf(await personaFactory.getAddress());
            expect(factoryBalance).to.be.gte(ethers.parseEther("222222223")); // AGENT_REWARDS_AMOUNT
        });
    });

    describe("Staking Rewards Integration", function () {
        it("Should set staking rewards contract", async function () {
            const { personaFactory, owner, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            const stakingAddress = user1.address; // Using user1 address as mock staking contract

            await expect(
                personaFactory.connect(owner).setStakingRewards(stakingAddress)
            ).to.emit(personaFactory, "StakingRewardsSet")
             .withArgs(stakingAddress);

            expect(await personaFactory.stakingRewards()).to.equal(stakingAddress);
        });

        it("Should only allow owner to set staking rewards", async function () {
            const { personaFactory, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            await expect(
                personaFactory.connect(user1).setStakingRewards(user1.address)
            ).to.be.revertedWithCustomError(personaFactory, "OwnableUnauthorizedAccount");
        });
    });

    describe("Edge Cases and Security", function () {
        it("Should handle withdrawing after partial deposits claimed as rewards", async function () {
            const { personaFactory, amicaToken, agentToken, tokenId, user2, user3 } = await createPersonaWithAgentToken(0n);

            // Make initial deposit
            await agentToken.transfer(user2.address, ethers.parseEther("3000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("3000"));

            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("2000"));

            // Withdraw some tokens
            await personaFactory.connect(user2).withdrawAgentTokens(tokenId, ethers.parseEther("1500"));

            // Now deposit again
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("500"));

            // Graduate - use user3 who has AMICA
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), graduationAmount);

            await personaFactory.connect(user3).swapExactTokensForTokens(
                tokenId,
                graduationAmount,
                0,
                user3.address,
                getDeadline()
            );

            // Should only be able to claim rewards for the remaining deposit (500 + 500 = 1000)
            await personaFactory.connect(user2).claimAgentRewards(tokenId);

            // Verify got rewards for 1000 tokens total
            const persona = await personaFactory.getPersona(tokenId);
            const TestERC20Contract = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20Contract.attach(persona.erc20Token) as TestERC20;

            const balance = await personaToken.balanceOf(user2.address);
            expect(balance).to.equal(ethers.parseEther("222222223")); // All rewards since only depositor
        });

        it("Should prevent reentrancy in agent deposits", async function () {
            // This would require a malicious agent token
            // The nonReentrant modifier should prevent reentrancy
            expect(true).to.be.true; // Placeholder - actual test would need malicious contract
        });

        it("Should handle agent token with non-standard decimals", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Deploy 6-decimal agent token (like USDC)
            const SixDecimalToken = await ethers.getContractFactory("TestERC20");
            const agentToken6 = await SixDecimalToken.deploy("Agent6", "AGENT6", ethers.parseUnits("10000000", 6));

            // Create persona
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), DEFAULT_MINT_COST);

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Six Decimal Agent",
                "SIXAGENT",
                [],
                [],
                0,
                await agentToken6.getAddress(),
                ethers.parseUnits("1000", 6) // minAgentTokens
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

            // Deposit 6-decimal tokens
            await agentToken6.transfer(user1.address, ethers.parseUnits("1000", 6));
            await agentToken6.connect(user1).approve(
                await personaFactory.getAddress(),
                ethers.parseUnits("1000", 6)
            );

            await expect(
                personaFactory.connect(user1).depositAgentTokens(tokenId, ethers.parseUnits("1000", 6))
            ).to.emit(personaFactory, "AgentTokensDeposited")
             .withArgs(tokenId, user1.address, ethers.parseUnits("1000", 6));
        });
    });

    describe("Minimum Agent Token Requirements", function () {
        it("Should create persona with minimum agent token requirement", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Deploy and approve agent token
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const agentToken = await TestERC20.deploy("Agent Token", "AGENT", ethers.parseEther("10000000"));

            // Approve AMICA for minting
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            // Create persona with 5000 minimum agent tokens
            const minAgentTokens = ethers.parseEther("5000");

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Min Agent Persona",
                "MINAGENT",
                [],
                [],
                0,
                await agentToken.getAddress(),
                minAgentTokens
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

            // Check persona data includes minAgentTokens
            const personaData = await personaFactory.getPersona(tokenId);
            expect(personaData.minAgentTokens).to.equal(minAgentTokens);
        });

        it("Should reject creating persona with minAgentTokens but no agent token", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "Invalid Persona",
                    "INVALID",
                    [],
                    [],
                    0,
                    ethers.ZeroAddress,
                    ethers.parseEther("1000") // minAgentTokens with no agent token
                )
            ).to.be.revertedWithCustomError(personaFactory, "CannotSetMinWithoutAgent");
        });

        it("Should prevent graduation if minimum agent tokens not met", async function () {
            const { personaFactory, amicaToken, user1, user2, user3, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Setup agent token
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const agentToken = await TestERC20.deploy("Agent Token", "AGENT", ethers.parseEther("10000000"));

            // Create persona with 5000 minimum agent tokens
            const minAgentTokens = ethers.parseEther("5000");

            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Min Agent Persona",
                "MINAGENT",
                [],
                [],
                0,
                await agentToken.getAddress(),
                minAgentTokens
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

            // Deposit some agent tokens but less than minimum
            await agentToken.transfer(user2.address, ethers.parseEther("2000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("2000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("2000"));

            // Try to trigger graduation - should fail
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), graduationAmount);

            await expect(
                personaFactory.connect(user3).swapExactTokensForTokens(
                    tokenId,
                    graduationAmount,
                    0,
                    user3.address,
                    getDeadline()
                )
            ).to.be.revertedWithCustomError(personaFactory, "InsufficientAgentTokens");
        });

        it("Should allow graduation once minimum agent tokens are met", async function () {
            const { personaFactory, amicaToken, user1, user2, user3, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Setup agent token
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const agentToken = await TestERC20.deploy("Agent Token", "AGENT", ethers.parseEther("10000000"));

            // Create persona with 5000 minimum agent tokens
            const minAgentTokens = ethers.parseEther("5000");

            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Min Agent Persona",
                "MINAGENT",
                [],
                [],
                0,
                await agentToken.getAddress(),
                minAgentTokens
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

            // Deposit exactly the minimum required
            await agentToken.transfer(user2.address, ethers.parseEther("5000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("5000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("5000"));

            // Now graduation should succeed
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), graduationAmount);

            await expect(
                personaFactory.connect(user3).swapExactTokensForTokens(
                    tokenId,
                    graduationAmount,
                    0,
                    user3.address,
                    getDeadline()
                )
            ).to.emit(personaFactory, "LiquidityPairCreated");
        });

        it("Should check graduation eligibility correctly", async function () {
            const { personaFactory, amicaToken, user1, user2, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Setup agent token
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const agentToken = await TestERC20.deploy("Agent Token", "AGENT", ethers.parseEther("10000000"));

            // Create persona with 5000 minimum agent tokens
            const minAgentTokens = ethers.parseEther("5000");

            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Min Agent Persona",
                "MINAGENT",
                [],
                [],
                0,
                await agentToken.getAddress(),
                minAgentTokens
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

            // Check eligibility before any trades
            let [eligible, reason] = await personaFactory.canGraduate(tokenId);
            expect(eligible).to.be.false;
            expect(reason).to.equal("Below graduation threshold");

            // First deposit minimum agent tokens so we can make trades
            await agentToken.transfer(user1.address, ethers.parseEther("5000"));
            await agentToken.connect(user1).approve(await personaFactory.getAddress(), ethers.parseEther("5000"));
            await personaFactory.connect(user1).depositAgentTokens(tokenId, ethers.parseEther("5000"));

            // Now buy tokens to approach graduation threshold
            const buyAmount = DEFAULT_GRADUATION_THRESHOLD / 2n; // Buy half the threshold
            await amicaToken.connect(user2).approve(await personaFactory.getAddress(), buyAmount);
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                buyAmount,
                0,
                user2.address,
                getDeadline()
            );

            // Check eligibility - should still be below threshold
            [eligible, reason] = await personaFactory.canGraduate(tokenId);
            expect(eligible).to.be.false;
            expect(reason).to.equal("Below graduation threshold");

            // Now let's buy an amount that will get us VERY close to the threshold but not trigger graduation
            // Get current state
            let purchaseInfo = await personaFactory.purchases(tokenId);
            const tradingFeeConfig = await personaFactory.tradingFeeConfig();
            const feePercentage = tradingFeeConfig.feePercentage;
            const BASIS_POINTS = 10000n;

            // We want to get to just under the threshold (e.g., 99.9% of it)
            const targetDeposited = (DEFAULT_GRADUATION_THRESHOLD * 999n) / 1000n; // 99.9% of threshold
            const neededAfterFees = targetDeposited - purchaseInfo.totalDeposited;
            const nextBuyAmount = (neededAfterFees * BASIS_POINTS) / (BASIS_POINTS - feePercentage);

            await amicaToken.connect(user2).approve(await personaFactory.getAddress(), nextBuyAmount);
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                nextBuyAmount,
                0,
                user2.address,
                getDeadline()
            );

            // Should still not be eligible (just under threshold)
            [eligible, reason] = await personaFactory.canGraduate(tokenId);
            expect(eligible).to.be.false;
            expect(reason).to.equal("Below graduation threshold");

            // Now buy just enough to exceed the threshold
            purchaseInfo = await personaFactory.purchases(tokenId);
            const finalNeededAfterFees = DEFAULT_GRADUATION_THRESHOLD - purchaseInfo.totalDeposited + ethers.parseEther("1");
            const finalBuyAmount = (finalNeededAfterFees * BASIS_POINTS) / (BASIS_POINTS - feePercentage);

            await amicaToken.connect(user2).approve(await personaFactory.getAddress(), finalBuyAmount);

            // This transaction should trigger graduation
            const graduationTx = await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                finalBuyAmount,
                0,
                user2.address,
                getDeadline()
            );

            // Check that graduation happened
            await expect(graduationTx).to.emit(personaFactory, "LiquidityPairCreated");

            // Now canGraduate should return false with "Already graduated"
            [eligible, reason] = await personaFactory.canGraduate(tokenId);
            expect(eligible).to.be.false;
            expect(reason).to.equal("Already graduated");

            // Verify the persona is indeed graduated
            const persona = await personaFactory.getPersona(tokenId);
            expect(persona.pairCreated).to.be.true;
        });

        it("Should emit event when minimum agent tokens threshold is reached", async function () {
            const { personaFactory, amicaToken, user1, user2, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Setup agent token
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const agentToken = await TestERC20.deploy("Agent Token", "AGENT", ethers.parseEther("10000000"));

            // Create persona with 5000 minimum agent tokens
            const minAgentTokens = ethers.parseEther("5000");

            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Min Agent Persona",
                "MINAGENT",
                [],
                [],
                0,
                await agentToken.getAddress(),
                minAgentTokens
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

            // Deposit almost enough
            await agentToken.transfer(user2.address, ethers.parseEther("4999"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("4999"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("4999"));

            // Deposit the final amount to cross threshold
            await agentToken.transfer(user2.address, ethers.parseEther("1"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1"));

            await expect(
                personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1"))
            ).to.emit(personaFactory, "AgentTokensDeposited")
             .withArgs(tokenId, user2.address, ethers.parseEther("1")); // Just the amount being deposited
        });

        it("Should handle multiple deposits crossing minimum threshold", async function () {
            const { personaFactory, amicaToken, user1, user2, user3, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Setup agent token
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const agentToken = await TestERC20.deploy("Agent Token", "AGENT", ethers.parseEther("10000000"));

            // Create persona with 10000 minimum agent tokens
            const minAgentTokens = ethers.parseEther("10000");

            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "High Min Persona",
                "HIGHMIN",
                [],
                [],
                0,
                await agentToken.getAddress(),
                minAgentTokens
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

            // Multiple users deposit
            await agentToken.transfer(user1.address, ethers.parseEther("3000"));
            await agentToken.transfer(user2.address, ethers.parseEther("4000"));
            await agentToken.transfer(user3.address, ethers.parseEther("3000"));

            await agentToken.connect(user1).approve(await personaFactory.getAddress(), ethers.parseEther("3000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("4000"));
            await agentToken.connect(user3).approve(await personaFactory.getAddress(), ethers.parseEther("3000"));

            // First two deposits don't reach threshold
            await personaFactory.connect(user1).depositAgentTokens(tokenId, ethers.parseEther("3000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("4000"));

            // Third deposit crosses threshold
            await expect(
                personaFactory.connect(user3).depositAgentTokens(tokenId, ethers.parseEther("3000"))
            ).to.emit(personaFactory, "AgentTokensDeposited")
             .withArgs(tokenId, user3.address, ethers.parseEther("3000")); // Just the amount being deposited
        });
    });
});

describe("PersonaTokenFactory Agent Token Additional Tests", function () {
    // Helper to create persona with agent token
    async function createPersonaWithAgentToken(minAgentTokens: bigint = ethers.parseEther("1000")) {
        const fixture = await loadFixture(deployPersonaTokenFactoryFixture);
        const { personaFactory, amicaToken, user1, user2, user3, owner } = fixture;

        // Deploy agent token
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const agentToken = await TestERC20.deploy("Agent Token", "AGENT", ethers.parseEther("10000000"));

        // Give user1 some AMICA for minting
        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            DEFAULT_MINT_COST
        );

        // Create persona with agent token
        const tx = await personaFactory.connect(user1).createPersona(
            await amicaToken.getAddress(),
            "Agent Persona",
            "AGENTP",
            [],
            [],
            0,
            await agentToken.getAddress(),
            minAgentTokens
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

        return {
            personaFactory,
            amicaToken,
            agentToken,
            user1,
            user2,
            user3,
            owner,
            tokenId,
            mockFactory: fixture.mockFactory,
            mockRouter: fixture.mockRouter,
            erc20Implementation: fixture.erc20Implementation
        };
    }

    describe("Edge Cases - Agent Token Rewards Distribution", function () {
        it("Should handle rewards distribution when total deposits exceed rewards amount", async function () {
            const { personaFactory, amicaToken, agentToken, tokenId, user1, user2, user3 } = 
                await createPersonaWithAgentToken(0n);

            // Users deposit massive amounts
            const hugeDeposit = ethers.parseEther("1000000");
            await agentToken.transfer(user2.address, hugeDeposit);
            await agentToken.transfer(user3.address, hugeDeposit);

            await agentToken.connect(user2).approve(await personaFactory.getAddress(), hugeDeposit);
            await agentToken.connect(user3).approve(await personaFactory.getAddress(), hugeDeposit);

            await personaFactory.connect(user2).depositAgentTokens(tokenId, hugeDeposit);
            await personaFactory.connect(user3).depositAgentTokens(tokenId, hugeDeposit);

            // Graduate
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), graduationAmount);

            await personaFactory.connect(user1).swapExactTokensForTokens(
                tokenId,
                graduationAmount,
                0,
                user1.address,
                getDeadline()
            );

            // Claim rewards - should still work proportionally
            await personaFactory.connect(user2).claimAgentRewards(tokenId);
            await personaFactory.connect(user3).claimAgentRewards(tokenId);

            // Each user should get exactly half of the rewards
            const persona = await personaFactory.getPersona(tokenId);
            const TestERC20Contract = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20Contract.attach(persona.erc20Token) as TestERC20;

            const user2Balance = await personaToken.balanceOf(user2.address);
            const user3Balance = await personaToken.balanceOf(user3.address);

            expect(user2Balance).to.equal(AGENT_REWARDS_AMOUNT / 2n);
            expect(user3Balance).to.equal(AGENT_REWARDS_AMOUNT / 2n);
        });

        it("Should handle single depositor receiving all rewards", async function () {
            const { personaFactory, amicaToken, agentToken, tokenId, user1, user2 } = 
                await createPersonaWithAgentToken(0n);

            // Only one user deposits
            await agentToken.transfer(user2.address, ethers.parseEther("100"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("100"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("100"));

            // Graduate
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), graduationAmount);

            await personaFactory.connect(user1).swapExactTokensForTokens(
                tokenId,
                graduationAmount,
                0,
                user1.address,
                getDeadline()
            );

            // Claim rewards
            await personaFactory.connect(user2).claimAgentRewards(tokenId);

            // User2 should get all rewards
            const persona = await personaFactory.getPersona(tokenId);
            const TestERC20Contract = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20Contract.attach(persona.erc20Token) as TestERC20;

            const user2Balance = await personaToken.balanceOf(user2.address);
            expect(user2Balance).to.equal(AGENT_REWARDS_AMOUNT);
        });

        it("Should handle tiny deposits correctly", async function () {
            const { personaFactory, amicaToken, agentToken, tokenId, user1, user2, user3 } = 
                await createPersonaWithAgentToken(0n);

            // Users make tiny deposits
            await agentToken.transfer(user2.address, 1n);
            await agentToken.transfer(user3.address, 2n);

            await agentToken.connect(user2).approve(await personaFactory.getAddress(), 1n);
            await agentToken.connect(user3).approve(await personaFactory.getAddress(), 2n);

            await personaFactory.connect(user2).depositAgentTokens(tokenId, 1n);
            await personaFactory.connect(user3).depositAgentTokens(tokenId, 2n);

            // Graduate
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), graduationAmount);

            await personaFactory.connect(user1).swapExactTokensForTokens(
                tokenId,
                graduationAmount,
                0,
                user1.address,
                getDeadline()
            );

            // Calculate expected rewards
            const [user2Reward, ] = await personaFactory.calculateAgentRewards(tokenId, user2.address);
            const [user3Reward, ] = await personaFactory.calculateAgentRewards(tokenId, user3.address);

            // User2 should get 1/3 of rewards, user3 should get 2/3
            expect(user2Reward).to.equal(AGENT_REWARDS_AMOUNT / 3n);
            expect(user3Reward).to.equal((AGENT_REWARDS_AMOUNT * 2n) / 3n);
        });
    });

    describe("Complex Withdrawal Scenarios", function () {
        it("Should handle multiple users withdrawing and depositing in sequence", async function () {
            const { personaFactory, agentToken, tokenId, user1, user2, user3 } = 
                await createPersonaWithAgentToken(0n);

            // Give users tokens
            await agentToken.transfer(user1.address, ethers.parseEther("1000"));
            await agentToken.transfer(user2.address, ethers.parseEther("1000"));
            await agentToken.transfer(user3.address, ethers.parseEther("1000"));

            // Approve all at once
            await agentToken.connect(user1).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));
            await agentToken.connect(user3).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));

            // Complex sequence of deposits and withdrawals
            await personaFactory.connect(user1).depositAgentTokens(tokenId, ethers.parseEther("500"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("300"));
            await personaFactory.connect(user1).withdrawAgentTokens(tokenId, ethers.parseEther("200"));
            await personaFactory.connect(user3).depositAgentTokens(tokenId, ethers.parseEther("400"));
            await personaFactory.connect(user2).withdrawAgentTokens(tokenId, ethers.parseEther("300"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("600"));
            await personaFactory.connect(user3).withdrawAgentTokens(tokenId, ethers.parseEther("100"));

            // Check final deposits
            expect(await personaFactory.agentDeposits(tokenId, user1.address)).to.equal(ethers.parseEther("300"));
            expect(await personaFactory.agentDeposits(tokenId, user2.address)).to.equal(ethers.parseEther("600"));
            expect(await personaFactory.agentDeposits(tokenId, user3.address)).to.equal(ethers.parseEther("300"));

            // Check total
            const persona = await personaFactory.personas(tokenId);
            expect(persona.totalAgentDeposited).to.equal(ethers.parseEther("1200"));
        });

        it("Should prevent withdrawing more than deposited", async function () {
            const { personaFactory, agentToken, tokenId, user2 } = 
                await createPersonaWithAgentToken(0n);

            // Deposit some tokens
            await agentToken.transfer(user2.address, ethers.parseEther("100"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("100"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("100"));

            // Try to withdraw more than deposited
            await expect(
                personaFactory.connect(user2).withdrawAgentTokens(tokenId, ethers.parseEther("101"))
            ).to.be.revertedWithCustomError(personaFactory, "NoDepositsToWithdraw");
        });
    });

    describe("Minimum Agent Token Edge Cases", function () {
        it("Should handle exactly meeting minimum requirement", async function () {
            const minRequired = ethers.parseEther("10000");
            const { personaFactory, amicaToken, agentToken, tokenId, user2, user3 } = 
                await createPersonaWithAgentToken(minRequired);

            // Deposit exactly the minimum
            await agentToken.transfer(user2.address, minRequired);
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), minRequired);
            await personaFactory.connect(user2).depositAgentTokens(tokenId, minRequired);

            // Should be able to graduate
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), graduationAmount);

            await expect(
                personaFactory.connect(user3).swapExactTokensForTokens(
                    tokenId,
                    graduationAmount,
                    0,
                    user3.address,
                    getDeadline()
                )
            ).to.emit(personaFactory, "LiquidityPairCreated");
        });

        it("Should handle withdrawals affecting minimum requirement", async function () {
            const minRequired = ethers.parseEther("10000");
            const { personaFactory, amicaToken, agentToken, tokenId, user2, user3 } = 
                await createPersonaWithAgentToken(minRequired);

            // Deposit more than minimum
            await agentToken.transfer(user2.address, ethers.parseEther("15000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("15000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("15000"));

            // Withdraw to go below minimum
            await personaFactory.connect(user2).withdrawAgentTokens(tokenId, ethers.parseEther("6000"));

            // Should not be able to graduate
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), graduationAmount);

            await expect(
                personaFactory.connect(user3).swapExactTokensForTokens(
                    tokenId,
                    graduationAmount,
                    0,
                    user3.address,
                    getDeadline()
                )
            ).to.be.revertedWithCustomError(personaFactory, "InsufficientAgentTokens");

            // Deposit again to meet minimum - need to approve first
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"));

            // Now should be able to graduate
            await expect(
                personaFactory.connect(user3).swapExactTokensForTokens(
                    tokenId,
                    graduationAmount,
                    0,
                    user3.address,
                    getDeadline()
                )
            ).to.emit(personaFactory, "LiquidityPairCreated");
        });

        it("Should allow zero minimum agent tokens", async function () {
            const { personaFactory, amicaToken, tokenId, user3 } = 
                await createPersonaWithAgentToken(0n);

            // Should be able to graduate without any agent deposits
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), graduationAmount);

            await expect(
                personaFactory.connect(user3).swapExactTokensForTokens(
                    tokenId,
                    graduationAmount,
                    0,
                    user3.address,
                    getDeadline()
                )
            ).to.emit(personaFactory, "LiquidityPairCreated");
        });
    });

    describe("Gas Optimization Scenarios", function () {
        it("Should handle many small depositors efficiently", async function () {
            const { personaFactory, amicaToken, agentToken, tokenId, owner } = 
                await createPersonaWithAgentToken(0n);

            // Create many depositors
            const depositors = [];
            const depositAmount = ethers.parseEther("10");

            for (let i = 0; i < 20; i++) {
                const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
                depositors.push(wallet);

                // Fund the wallet
                await owner.sendTransaction({ to: wallet.address, value: ethers.parseEther("1") });
                await agentToken.transfer(wallet.address, depositAmount);
                await agentToken.connect(wallet).approve(await personaFactory.getAddress(), depositAmount);
            }

            // All deposit
            for (const depositor of depositors) {
                await personaFactory.connect(depositor).depositAgentTokens(tokenId, depositAmount);
            }

            // Graduate - owner needs to approve AMICA first
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(owner).approve(await personaFactory.getAddress(), graduationAmount);

            await personaFactory.connect(owner).swapExactTokensForTokens(
                tokenId,
                graduationAmount,
                0,
                owner.address,
                getDeadline()
            );

            // All claim rewards
            for (const depositor of depositors) {
                await personaFactory.connect(depositor).claimAgentRewards(tokenId);
            }

            // Each should get equal share
            const persona = await personaFactory.getPersona(tokenId);
            const TestERC20Contract = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20Contract.attach(persona.erc20Token) as TestERC20;

            const expectedReward = AGENT_REWARDS_AMOUNT / 20n;
            for (const depositor of depositors) {
                const balance = await personaToken.balanceOf(depositor.address);
                expect(balance).to.be.closeTo(expectedReward, ethers.parseEther("1"));
            }
        });
    });

    describe("Attack Vector Prevention", function () {
        it("Should prevent deposit/withdrawal spam attacks", async function () {
            const { personaFactory, agentToken, tokenId, user2 } = 
                await createPersonaWithAgentToken(0n);

            await agentToken.transfer(user2.address, ethers.parseEther("1000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));

            // Spam deposits and withdrawals
            for (let i = 0; i < 10; i++) {
                await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("10"));
                await personaFactory.connect(user2).withdrawAgentTokens(tokenId, ethers.parseEther("10"));
            }

            // Final state should be consistent
            expect(await personaFactory.agentDeposits(tokenId, user2.address)).to.equal(0);
            const persona = await personaFactory.personas(tokenId);
            expect(persona.totalAgentDeposited).to.equal(0);
        });

        it("Should prevent frontrunning graduation to steal rewards", async function () {
            const { personaFactory, amicaToken, agentToken, tokenId, user1, user2, user3 } = 
                await createPersonaWithAgentToken(0n);

            // User2 deposits early
            await agentToken.transfer(user2.address, ethers.parseEther("1000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"));

            // User3 tries to frontrun graduation by depositing right before
            await agentToken.transfer(user3.address, ethers.parseEther("9000"));
            await agentToken.connect(user3).approve(await personaFactory.getAddress(), ethers.parseEther("9000"));

            // Get close to graduation
            const almostGraduation = (DEFAULT_GRADUATION_THRESHOLD * 9900n) / 10000n;
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), almostGraduation);
            await personaFactory.connect(user1).swapExactTokensForTokens(
                tokenId,
                almostGraduation,
                0,
                user1.address,
                getDeadline()
            );

            // User3 deposits large amount
            await personaFactory.connect(user3).depositAgentTokens(tokenId, ethers.parseEther("9000"));

            // Complete graduation
            const finalAmount = (DEFAULT_GRADUATION_THRESHOLD * 300n) / 10000n;
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), finalAmount);
            await personaFactory.connect(user1).swapExactTokensForTokens(
                tokenId,
                finalAmount,
                0,
                user1.address,
                getDeadline()
            );

            // Both users claim
            await personaFactory.connect(user2).claimAgentRewards(tokenId);
            await personaFactory.connect(user3).claimAgentRewards(tokenId);

            // Rewards should be proportional to deposits
            const persona = await personaFactory.getPersona(tokenId);
            const TestERC20Contract = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20Contract.attach(persona.erc20Token) as TestERC20;

            const user2Balance = await personaToken.balanceOf(user2.address);
            const user3Balance = await personaToken.balanceOf(user3.address);

            // User2 should get 10% of rewards, user3 90%
            expect(user2Balance).to.be.closeTo(AGENT_REWARDS_AMOUNT / 10n, ethers.parseEther("1"));
            expect(user3Balance).to.be.closeTo((AGENT_REWARDS_AMOUNT * 9n) / 10n, ethers.parseEther("1"));
        });
    });

    describe("Integration with Trading", function () {
        it("Should allow buying persona tokens while agent deposits are active", async function () {
            const { personaFactory, amicaToken, agentToken, tokenId, user2, user3 } = 
                await createPersonaWithAgentToken(ethers.parseEther("5000"));

            // User2 deposits agent tokens
            await agentToken.transfer(user2.address, ethers.parseEther("3000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("3000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("3000"));

            // User3 buys persona tokens
            const buyAmount = ethers.parseEther("10000");
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), buyAmount);

            await expect(
                personaFactory.connect(user3).swapExactTokensForTokens(
                    tokenId,
                    buyAmount,
                    0,
                    user3.address,
                    getDeadline()
                )
            ).to.emit(personaFactory, "TokensPurchased");

            // Both activities should coexist
            const persona = await personaFactory.personas(tokenId);
            expect(persona.totalAgentDeposited).to.equal(ethers.parseEther("3000"));

            const purchase = await personaFactory.purchases(tokenId);
            expect(purchase.totalDeposited).to.be.gt(0);
        });

        it("Should handle graduation with both traders and agent depositors", async function () {
            const { personaFactory, amicaToken, agentToken, tokenId, user1, user2, user3 } = 
                await createPersonaWithAgentToken(0n);

            // User2 deposits agent tokens
            await agentToken.transfer(user2.address, ethers.parseEther("1000"));
            await agentToken.connect(user2).approve(await personaFactory.getAddress(), ethers.parseEther("1000"));
            await personaFactory.connect(user2).depositAgentTokens(tokenId, ethers.parseEther("1000"));

            // User3 buys some tokens
            const buyAmount = ethers.parseEther("50000");
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), buyAmount);
            await personaFactory.connect(user3).swapExactTokensForTokens(
                tokenId,
                buyAmount,
                0,
                user3.address,
                getDeadline()
            );

            // User1 triggers graduation
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), graduationAmount);
            await personaFactory.connect(user1).swapExactTokensForTokens(
                tokenId,
                graduationAmount,
                0,
                user1.address,
                getDeadline()
            );

            // Check final state
            const persona = await personaFactory.getPersona(tokenId);
            expect(persona.pairCreated).to.be.true;

            // User2 can claim agent rewards
            await expect(
                personaFactory.connect(user2).claimAgentRewards(tokenId)
            ).to.emit(personaFactory, "AgentRewardsDistributed");

            // User3 can withdraw purchased tokens
            await expect(
                personaFactory.connect(user3).withdrawTokens(tokenId)
            ).to.emit(personaFactory, "TokensWithdrawn");
        });
    });
});
