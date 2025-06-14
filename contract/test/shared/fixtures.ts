import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { 
    PersonaTokenFactory,
    AmicaToken,
    ERC20Implementation,
    MockUniswapV2Factory,
    MockUniswapV2Router,
    TestERC20
} from "../../typechain-types";

// Constants
export const SECONDS_IN_HOUR = 3600;
export const SECONDS_IN_DAY = 86400;
export const DEFAULT_MINT_COST = ethers.parseEther("1000");
export const DEFAULT_GRADUATION_THRESHOLD = ethers.parseEther("1000000");

// Token distribution constants - matching the contract
export const PERSONA_TOKEN_SUPPLY = ethers.parseEther("1000000000");

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
    personaFactory: PersonaTokenFactory,
    tokenId: number
): Promise<{
    liquidityAmount: bigint;
    bondingAmount: bigint;
    amicaAmount: bigint;
    agentRewardsAmount: bigint;
}> {
    return personaFactory.getTokenDistribution(tokenId);
}

// Fixture interfaces
export interface MocksFixture {
    mockFactory: MockUniswapV2Factory;
    mockRouter: MockUniswapV2Router;
}

export interface PersonaTokenFactoryFixture extends MocksFixture {
    personaFactory: PersonaTokenFactory;
    amicaToken: AmicaToken;
    erc20Implementation: ERC20Implementation;
    owner: SignerWithAddress;
    user1: SignerWithAddress;
    user2: SignerWithAddress;
    user3: SignerWithAddress;
}

export interface CreatePersonaFixture extends PersonaTokenFactoryFixture {
    tokenId: number;
}

// Fixtures
export async function deployMocksFixture(): Promise<MocksFixture> {
    const MockUniswapV2Factory = await ethers.getContractFactory("MockUniswapV2Factory");
    const mockFactory = await MockUniswapV2Factory.deploy();

    const MockUniswapV2Router = await ethers.getContractFactory("MockUniswapV2Router");
    const mockRouter = await MockUniswapV2Router.deploy();

    return { mockFactory, mockRouter };
}

export async function deployPersonaTokenFactoryFixture(): Promise<PersonaTokenFactoryFixture> {
    const [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy mocks
    const { mockFactory, mockRouter } = await loadFixture(deployMocksFixture);

    // Deploy AmicaToken
    const AmicaToken = await ethers.getContractFactory("AmicaToken");
    const amicaToken = await AmicaToken.deploy(owner.address);

    // Since we're not on mainnet, we need to set up a bridge wrapper to mint tokens
    const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
    
    // Deploy a mock bridged token
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const bridgedAmica = await TestERC20.deploy("Bridged Amica", "BAMICA", ethers.parseEther("100000000"));
    
    // Deploy bridge wrapper
    const bridgeWrapper = await AmicaBridgeWrapper.deploy(
        await bridgedAmica.getAddress(),
        await amicaToken.getAddress(),
        owner.address
    );
    
    // Set bridge wrapper in AmicaToken
    await amicaToken.setBridgeWrapper(await bridgeWrapper.getAddress());
    
    // Now we can mint native AMICA by wrapping bridged tokens
    const userAmount = ethers.parseEther("10000000");
    
    // Give owner bridged tokens
    await bridgedAmica.transfer(owner.address, ethers.parseEther("50000000"));
    
    // Wrap bridged tokens to get native AMICA for each user
    for (const user of [user1, user2, user3]) {
        await bridgedAmica.approve(await bridgeWrapper.getAddress(), userAmount);
        await bridgeWrapper.wrap(userAmount);
        await amicaToken.transfer(user.address, userAmount);
    }

    // Deploy ERC20Implementation
    const ERC20Implementation = await ethers.getContractFactory("ERC20Implementation");
    const erc20Implementation = await ERC20Implementation.deploy();

    // Deploy PersonaTokenFactory using upgrades
    const PersonaTokenFactory = await ethers.getContractFactory("PersonaTokenFactory");
    const personaFactory = await upgrades.deployProxy(
        PersonaTokenFactory,
        [
            await amicaToken.getAddress(),
            await mockFactory.getAddress(),
            await mockRouter.getAddress(),
            await erc20Implementation.getAddress()
        ],
        { initializer: "initialize" }
    ) as unknown as PersonaTokenFactory;

    // Remove these lines - constants are now defined at the top of the file
    // PERSONA_TOKEN_SUPPLY = await personaFactory.PERSONA_TOKEN_SUPPLY();
    // AMICA_DEPOSIT_AMOUNT = await personaFactory.AMICA_DEPOSIT_AMOUNT();
    // BONDING_CURVE_AMOUNT = await personaFactory.BONDING_CURVE_AMOUNT();
    // LIQUIDITY_TOKEN_AMOUNT = await personaFactory.LIQUIDITY_TOKEN_AMOUNT();

    return {
        personaFactory,
        amicaToken,
        erc20Implementation,
        mockFactory,
        mockRouter,
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
        ethers.ZeroAddress  // No agent token
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

    // Approve agent token in factory
    await personaFactory.connect(owner).approveAgentToken(await agentToken.getAddress(), true);

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
        await agentToken.getAddress()
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
