import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
    PersonaTokenFactory,
    PersonaFactoryViewer,
    AmicaToken,
    ERC20Implementation,
    MockUniswapV2Factory,
    MockUniswapV2Router,
    TestERC20,
    AmicaBridgeWrapper
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

// Fixture interfaces
export interface MocksFixture {
    mockFactory: MockUniswapV2Factory;
    mockRouter: MockUniswapV2Router;
}

export interface PersonaTokenFactoryFixture extends MocksFixture {
    personaFactory: PersonaTokenFactory;
    viewer: PersonaFactoryViewer;
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

// Add these to test/shared/fixtures.ts

// Add new fixture interfaces
export interface AmicaTokenFixture {
    amicaToken: AmicaToken;
    bridgeWrapper: AmicaBridgeWrapper;
    bridgedAmica: TestERC20;
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
        [owner.address],
        { initializer: "initialize" }
    ) as unknown as AmicaToken;

    // Deploy a mock bridged token
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const bridgedAmica = await TestERC20.deploy("Bridged Amica", "BAMICA", ethers.parseEther("1000000000"));

    // Deploy AmicaBridgeWrapper using upgrades plugin
    const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
    const bridgeWrapper = await upgrades.deployProxy(
        AmicaBridgeWrapper,
        [
            await bridgedAmica.getAddress(),
            await amicaToken.getAddress(),
            owner.address
        ],
        { initializer: "initialize" }
    ) as unknown as AmicaBridgeWrapper;

    // Set bridge wrapper in AmicaToken
    await amicaToken.setBridgeWrapper(await bridgeWrapper.getAddress());

    // Wrap bridged tokens to get native AMICA
    await bridgedAmica.approve(await bridgeWrapper.getAddress(), ethers.parseEther("1000000000"));
    await bridgeWrapper.wrap(ethers.parseEther("1000000000"));

    // Now amicaToken has the total supply, transfer to users
    const userAmount = ethers.parseEther("10000");
    await amicaToken.transfer(user1.address, userAmount);
    await amicaToken.transfer(user2.address, userAmount);
    await amicaToken.transfer(user3.address, userAmount);
    await amicaToken.transfer(user4.address, userAmount);

    return { amicaToken, bridgeWrapper, bridgedAmica, owner, user1, user2, user3, user4 };
}

export async function deployAmicaTokenMainnetMockFixture(): Promise<AmicaTokenFixture> {
    const [owner, user1, user2, user3, user4] = await ethers.getSigners();

    // Deploy the mainnet mock using upgrades plugin
    const AmicaTokenMainnetMock = await ethers.getContractFactory("AmicaTokenMainnetMock");
    const amicaToken = await upgrades.deployProxy(
        AmicaTokenMainnetMock,
        [owner.address],
        { initializer: "initialize" }
    ) as unknown as AmicaToken;

    // On mainnet, tokens are already minted to the contract
    // No need for bridge wrapper setup
    const bridgeWrapper = null as any; // Not needed for mainnet
    const bridgedAmica = null as any; // Not needed for mainnet

    return { amicaToken, bridgeWrapper, bridgedAmica, owner, user1, user2, user3, user4 };
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

// Helper to setup a complete cross-chain scenario
export async function setupCrossChainScenario() {
    const [owner, user1] = await ethers.getSigners();

    // Deploy L2 AmicaToken
    const AmicaToken = await ethers.getContractFactory("AmicaToken");
    const l2AmicaToken = await upgrades.deployProxy(
        AmicaToken,
        [owner.address],
        { initializer: "initialize" }
    ) as unknown as AmicaToken;

    // Deploy bridge components
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const bridgedAmica = await TestERC20.deploy("Bridged Amica", "BAMICA", ethers.parseEther("1000000"));

    // Deploy AmicaBridgeWrapper using upgrades plugin
    const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
    const bridgeWrapper = await upgrades.deployProxy(
        AmicaBridgeWrapper,
        [
            await bridgedAmica.getAddress(),
            await l2AmicaToken.getAddress(),
            owner.address
        ],
        { initializer: "initialize" }
    ) as unknown as AmicaBridgeWrapper;

    await l2AmicaToken.setBridgeWrapper(await bridgeWrapper.getAddress());

    return {
        l2AmicaToken,
        bridgedAmica,
        bridgeWrapper,
        owner,
        user1
    };
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

    // Deploy AmicaToken using upgrades plugin
    const AmicaToken = await ethers.getContractFactory("AmicaToken");
    const amicaToken = await upgrades.deployProxy(
        AmicaToken,
        [owner.address],
        { initializer: "initialize" }
    ) as unknown as AmicaToken;

    // Deploy a mock bridged token
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const bridgedAmica = await TestERC20.deploy("Bridged Amica", "BAMICA", ethers.parseEther("100000000"));

    // Deploy AmicaBridgeWrapper using upgrades plugin
    const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
    const bridgeWrapper = await upgrades.deployProxy(
        AmicaBridgeWrapper,
        [
            await bridgedAmica.getAddress(),
            await amicaToken.getAddress(),
            owner.address
        ],
        { initializer: "initialize" }
    ) as unknown as AmicaBridgeWrapper;

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

    // Deploy viewer contract
    const viewer = await deployViewer(await personaFactory.getAddress());

    return {
        personaFactory,
        viewer,
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

// Deploy function specifically for mainnet mock testing
export async function deployPersonaTokenFactoryWithMainnetMockFixture(): Promise<PersonaTokenFactoryFixture> {
    const [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy mocks
    const { mockFactory, mockRouter } = await loadFixture(deployMocksFixture);

    // Deploy AmicaTokenMainnetMock using upgrades plugin
    const AmicaTokenMainnetMock = await ethers.getContractFactory("AmicaTokenMainnetMock");
    const amicaToken = await upgrades.deployProxy(
        AmicaTokenMainnetMock,
        [owner.address],
        { initializer: "initialize" }
    ) as unknown as AmicaToken;

    // For mainnet mock, tokens are already minted to the contract
    // Transfer tokens to users for testing
    const userAmount = ethers.parseEther("10000000");
    for (const user of [user1, user2, user3]) {
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

    // Deploy viewer contract
    const viewer = await deployViewer(await personaFactory.getAddress());

    return {
        personaFactory,
        viewer,
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

// Helper function to deploy bridge wrapper with specific configuration
export async function deployBridgeWrapperWithConfig(
    bridgedToken: string,
    nativeToken: string,
    owner: string,
    config?: {
        globalDailyLimit?: bigint;
        bridgeFee?: number;
        feeRecipient?: string;
    }
): Promise<AmicaBridgeWrapper> {
    const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
    const bridgeWrapper = await upgrades.deployProxy(
        AmicaBridgeWrapper,
        [bridgedToken, nativeToken, owner],
        { initializer: "initialize" }
    ) as unknown as AmicaBridgeWrapper;

    return bridgeWrapper;
}

// Helper to test bridge wrapper upgrade
export async function upgradeBridgeWrapper(
    proxyAddress: string,
    newImplementationName: string = "AmicaBridgeWrapperV2"
): Promise<AmicaBridgeWrapper> {
    const NewImplementation = await ethers.getContractFactory(newImplementationName);
    const upgraded = await upgrades.upgradeProxy(
        proxyAddress,
        NewImplementation
    ) as unknown as AmicaBridgeWrapper;

    return upgraded;
}
