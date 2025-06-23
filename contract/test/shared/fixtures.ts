import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
    PersonaTokenFactory,
    PersonaFactoryViewer,
    AmicaToken,
    ERC20Implementation,
    TestERC20,
    UniswapV4Manager,
    IPoolManager
} from "../../typechain-types";

// Constants
export const SECONDS_IN_HOUR = 3600;
export const SECONDS_IN_DAY = 86400;
export const DEFAULT_MINT_COST = ethers.parseEther("1000");
export const DEFAULT_GRADUATION_THRESHOLD = ethers.parseEther("1000000");

// Token distribution constants - matching the contract
export const PERSONA_TOKEN_SUPPLY = ethers.parseEther("1000000000");
export const AMICA_TOTAL_SUPPLY = ethers.parseEther("1000000000");

// Standard distribution (no agent token)
export const STANDARD_LIQUIDITY_AMOUNT = ethers.parseEther("333333333");
export const STANDARD_BONDING_AMOUNT = ethers.parseEther("333333333");
export const STANDARD_AMICA_AMOUNT = ethers.parseEther("333333334");

// Agent distribution
export const AGENT_LIQUIDITY_AMOUNT = ethers.parseEther("333333333");
export const AGENT_BONDING_AMOUNT = ethers.parseEther("222222222");
export const AGENT_AMICA_AMOUNT = ethers.parseEther("222222222");
export const AGENT_REWARDS_AMOUNT = ethers.parseEther("222222223");

// Default values for backward compatibility (standard case)
export const LIQUIDITY_TOKEN_AMOUNT = STANDARD_LIQUIDITY_AMOUNT;
export const BONDING_CURVE_AMOUNT = STANDARD_BONDING_AMOUNT;
export const AMICA_DEPOSIT_AMOUNT = STANDARD_AMICA_AMOUNT;

// Helper functions
export function getDeadline(offsetSeconds: number = SECONDS_IN_HOUR): number {
    return Math.floor(Date.now() / 1000) + offsetSeconds;
}

export async function swapTokensForPersona(
    personaFactory: PersonaTokenFactory,
    tokenId: number,
    amountIn: bigint,
    minAmountOut: bigint,
    buyer: SignerWithAddress,
    recipient?: string
) {
    const deadline = getDeadline();
    const to = recipient || buyer.address;

    return personaFactory.connect(buyer).swapExactTokensForTokens(
        tokenId,
        amountIn,
        minAmountOut,
        to,
        deadline
    );
}

export async function getQuote(
    personaFactory: PersonaTokenFactory,
    tokenId: number,
    amountIn: bigint
): Promise<bigint> {
    return personaFactory.getAmountOut(tokenId, amountIn);
}

// Helper to get token distribution for a specific persona
export async function getTokenDistribution(
    viewer: PersonaFactoryViewer,
    tokenId: number
): Promise<{
    liquidityAmount: bigint;
    bondingAmount: bigint;
    amicaAmount: bigint;
    agentRewardsAmount: bigint;
}> {
    return viewer.getTokenDistribution(tokenId);
}

// Helper to deploy viewer contract
export async function deployViewer(factoryAddress: string): Promise<PersonaFactoryViewer> {
    const PersonaFactoryViewer = await ethers.getContractFactory("PersonaFactoryViewer");
    return await PersonaFactoryViewer.deploy(factoryAddress) as PersonaFactoryViewer;
}

export interface UniswapV4Fixture {
    poolManager: IPoolManager;
}

export interface PersonaTokenFactoryFixture {
    personaFactory: PersonaTokenFactory;
    viewer: PersonaFactoryViewer;
    amicaToken: AmicaToken;
    poolManager: IPoolManager;
    uniswapV4Manager: UniswapV4Manager;
    erc20Implementation: ERC20Implementation;
    owner: SignerWithAddress;
    user1: SignerWithAddress;
    user2: SignerWithAddress;
    user3: SignerWithAddress;
}

export interface CreatePersonaFixture extends PersonaTokenFactoryFixture {
    tokenId: number;
}

// Add these to test/shared/fixtures.ts

// Add new fixture interfaces
export interface AmicaTokenFixture {
    amicaToken: AmicaToken;
    owner: SignerWithAddress;
    user1: SignerWithAddress;
    user2: SignerWithAddress;
    user3: SignerWithAddress;
    user4: SignerWithAddress;
}

export interface AmicaTokenWithTokensFixture extends AmicaTokenFixture {
    usdc: TestERC20;
    weth: TestERC20;
    dai: TestERC20;
}

// Add new fixtures for AmicaToken testing
export async function deployAmicaTokenFixture(): Promise<AmicaTokenFixture> {
    const [owner, user1, user2, user3, user4] = await ethers.getSigners();

    // Deploy AmicaToken using upgrades plugin
    const AmicaToken = await ethers.getContractFactory("AmicaToken");
    const amicaToken = await upgrades.deployProxy(
        AmicaToken,
        [owner.address, AMICA_TOTAL_SUPPLY],
        { initializer: "initialize" }
    ) as unknown as AmicaToken;

    // Now amicaToken has the total supply, transfer to users
    const userAmount = ethers.parseEther("10000");
    await amicaToken.transfer(user1.address, userAmount);
    await amicaToken.transfer(user2.address, userAmount);
    await amicaToken.transfer(user3.address, userAmount);
    await amicaToken.transfer(user4.address, userAmount);

    return { amicaToken, owner, user1, user2, user3, user4 };
}

export async function deployAmicaTokenWithTokensFixture(): Promise<AmicaTokenWithTokensFixture> {
    const baseFixture = await loadFixture(deployAmicaTokenFixture);
    const { owner, user1 } = baseFixture;

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

    return { ...baseFixture, usdc, weth, dai };
}

// Fixtures
export async function deployUniswapV4Fixture(): Promise<UniswapV4Fixture> {
    const initialOwner = (await ethers.getSigners())[0];

    const PoolManager = await ethers.getContractFactory("PoolManager");
    const poolManager = await PoolManager.deploy(initialOwner) as unknown as IPoolManager;

    return { poolManager };
}

export async function deployPersonaTokenFactoryFixture(): Promise<PersonaTokenFactoryFixture> {
    const [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy mocks
    const { poolManager } = await loadFixture(deployUniswapV4Fixture);

    // Deploy AmicaToken using upgrades plugin
    const AmicaToken = await ethers.getContractFactory("AmicaToken");
    const amicaToken = await upgrades.deployProxy(
        AmicaToken,
        [owner.address, AMICA_TOTAL_SUPPLY],
        { initializer: "initialize" }
    ) as unknown as AmicaToken;

    const userAmount = ethers.parseEther("10000000");

    // Give owner bridged tokens
    await amicaToken.transfer(owner.address, ethers.parseEther("50000000"));

    for (const user of [user1, user2, user3]) {
        await amicaToken.transfer(user.address, userAmount);
    }

    // Deploy fee reduction hook
    const AmicaFeeReductionHook = await ethers.getContractFactory("AmicaFeeReductionHook");
    console.log('PoolManager address:', await poolManager.getAddress());
    const feeReductionHook = await AmicaFeeReductionHook.deploy(
        await poolManager.getAddress()
    );

    // Deploy ERC20Implementation
    const ERC20Implementation = await ethers.getContractFactory("ERC20Implementation");
    const erc20Implementation = await ERC20Implementation.deploy();

    const UniswapV4Manager = await ethers.getContractFactory("UniswapV4Manager");
    const uniswapV4Manager = await UniswapV4Manager.deploy(
        await poolManager.getAddress(),
        await feeReductionHook.getAddress()
    );

    // Deploy PersonaTokenFactory using upgrades
    const PersonaTokenFactory = await ethers.getContractFactory("PersonaTokenFactory");
    const personaFactory = await upgrades.deployProxy(
        PersonaTokenFactory,
        [
            await amicaToken.getAddress(),
            await poolManager.getAddress(),
            await feeReductionHook.getAddress(),
            await erc20Implementation.getAddress()
        ],
        { initializer: "initialize" }
    ) as unknown as PersonaTokenFactory;

    feeReductionHook.setPersonaFactory(await personaFactory.getAddress());
    feeReductionHook.transferOwnership(await personaFactory.getAddress());

    // Deploy viewer contract
    const viewer = await deployViewer(await personaFactory.getAddress());

    return {
        personaFactory,
        viewer,
        amicaToken,
        erc20Implementation,
        poolManager,
        uniswapV4Manager,
        feeReductionHook,
        owner,
        user1,
        user2,
        user3
    };
}

export async function createPersonaFixture(): Promise<CreatePersonaFixture> {
    const fixture = await loadFixture(deployPersonaTokenFactoryFixture);
    const { personaFactory, amicaToken, user1 } = fixture;

    // Approve AMICA for minting
    await amicaToken.connect(user1).approve(
        await personaFactory.getAddress(),
        DEFAULT_MINT_COST
    );

    // Create persona (without agent token)
    const tx = await personaFactory.connect(user1).createPersona(
        await amicaToken.getAddress(),
        "Test Persona",
        "TESTP",
        ["description", "image"],
        ["A test persona", "https://example.com/image.png"],
        0,
        ethers.ZeroAddress,  // No agent token
        0, // No minimum agent tokens
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

    return { ...fixture, tokenId };
}

// Additional fixture for creating persona with agent token
export async function createPersonaWithAgentFixture(): Promise<CreatePersonaFixture & { agentToken: TestERC20 }> {
    const fixture = await loadFixture(deployPersonaTokenFactoryFixture);
    const { personaFactory, amicaToken, user1, owner } = fixture;

    // Deploy an agent token
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const agentToken = await TestERC20.deploy("Agent Token", "AGENT", ethers.parseEther("1000000000"));

    // Give user1 some agent tokens
    await agentToken.transfer(user1.address, ethers.parseEther("1000000"));

    // Approve AMICA for minting
    await amicaToken.connect(user1).approve(
        await personaFactory.getAddress(),
        DEFAULT_MINT_COST
    );

    // Create persona with agent token
    const tx = await personaFactory.connect(user1).createPersona(
        await amicaToken.getAddress(),
        "Agent Persona",
        "AGENTP",
        ["description", "image"],
        ["A persona with agent token", "https://example.com/agent.png"],
        0,
        await agentToken.getAddress(),
        0, // No minimum agent tokens
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

    return { ...fixture, tokenId, agentToken };
}
