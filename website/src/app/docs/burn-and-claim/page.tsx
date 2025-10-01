'use client'

import Layout from '@/components/Layout'
import { DocsPageLayout } from '../components/DocsPageLayout'

export default function BurnAndClaimPage() {
  return (
    <Layout>
      <DocsPageLayout>
        <h1>Burn & Claim</h1>
        <p className="lead">
          Redeem your proportional share of treasury assets by burning tokens
        </p>

        <section>
          <h2>Overview</h2>
          <p>
            The Burn & Claim mechanism is a core feature of the Amica ecosystem that allows token holders
            to redeem their proportional share of underlying assets by burning their tokens. This creates
            a fair, trustless way to access treasury value without requiring governance or centralized control.
          </p>
          <p>
            This mechanism is used by:
          </p>
          <ul>
            <li><strong>AMICA Token</strong>: Burn AMICA to claim proportional treasury assets (AIUS, ETH, fees, etc.)</li>
            <li><strong>Persona Tokens</strong>: Burn persona tokens to claim proportional LP tokens and treasury assets</li>
          </ul>
        </section>

        <section>
          <h2>How It Works</h2>

          <h3>Basic Mechanism</h3>
          <p>The formula is simple and trustless:</p>
          <pre><code>{`Your Share = (Tokens You Burn / Total Token Supply) × Treasury Balance

Example:
- You burn: 100 tokens
- Total supply: 1000 tokens
- Treasury has: 500 USDC

Your share = (100 / 1000) × 500 = 50 USDC`}</code></pre>

          <h3>Process Flow</h3>
          <ol>
            <li><strong>Select Tokens</strong>: Choose which treasury assets you want to claim (ETH, AIUS, LP tokens, etc.)</li>
            <li><strong>Specify Amount</strong>: Decide how many tokens to burn</li>
            <li><strong>Burn</strong>: Tokens are permanently destroyed, reducing total supply</li>
            <li><strong>Claim</strong>: You receive your proportional share of each selected asset</li>
          </ol>

          <div className="p-4 bg-blue-500/10 backdrop-blur-sm rounded-lg border border-blue-500/20 my-4">
            <p className="text-sm text-blue-400">
              ℹ️ <strong>Important:</strong> Burning is permanent and irreversible. Calculate your expected
              returns carefully before proceeding.
            </p>
          </div>
        </section>

        <section>
          <h2>Smart Contract Implementation</h2>

          <h3>BurnAndClaimBase Contract</h3>
          <p>
            All tokens in the ecosystem inherit from the <code>BurnAndClaimBase</code> contract,
            which implements the core burning logic:
          </p>

          <pre><code>{`abstract contract BurnAndClaimBase is
    IBurnAndClaim,
    ERC20Upgradeable,
    ReentrancyGuardUpgradeable
{
    function burnAndClaim(
        uint256 amountToBurn,
        address[] calldata tokens
    ) external nonReentrant {
        require(amountToBurn > 0, "InvalidBurnAmount");
        require(tokens.length > 0, "NoTokensSelected");

        uint256 currentSupply = totalSupply();

        // Burn tokens first (CEI pattern)
        _burn(msg.sender, amountToBurn);

        // Calculate and transfer proportional shares
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
            uint256 claimAmount = (balance * amountToBurn) / currentSupply;

            if (claimAmount > 0) {
                IERC20(tokens[i]).transfer(msg.sender, claimAmount);
            }
        }
    }
}`}</code></pre>

          <h3>Key Features</h3>
          <ul>
            <li><strong>Reentrancy Protected</strong>: Uses OpenZeppelin&apos;s ReentrancyGuard</li>
            <li><strong>CEI Pattern</strong>: Burns tokens before external calls for security</li>
            <li><strong>Multi-Asset</strong>: Claim multiple tokens in a single transaction</li>
            <li><strong>Proportional</strong>: Fair distribution based on burn amount</li>
            <li><strong>Gas Optimized</strong>: Efficient loops and calculations</li>
          </ul>
        </section>

        <section>
          <h2>Using Burn & Claim</h2>

          <h3>For AMICA Token</h3>
          <p>Burn AMICA to claim proportional shares of the protocol treasury:</p>

          <pre><code>{`import { parseEther } from 'viem';

// 1. Check treasury balances
const aiusBalance = await aiusToken.balanceOf(amicaTreasuryAddress);
const ethBalance = await provider.getBalance(amicaTreasuryAddress);

// 2. Calculate expected returns
const burnAmount = parseEther('1000'); // 1000 AMICA
const totalSupply = await amicaToken.totalSupply();

const expectedAius = (aiusBalance * burnAmount) / totalSupply;
const expectedEth = (ethBalance * burnAmount) / totalSupply;

// 3. Burn and claim (tokens must be sorted by address)
const tokens = [aiusTokenAddress, wethAddress].sort();

await amicaToken.burnAndClaim(burnAmount, tokens);

// You now have your proportional share of AIUS and ETH!`}</code></pre>

          <h3>For Persona Tokens</h3>
          <p>Burn persona tokens to claim proportional shares of treasury assets:</p>

          <pre><code>{`// 1. Check treasury assets
const treasuryAssets = await getPersonaTreasuryAssets(personaTokenAddress);

// 2. Burn persona tokens
const burnAmount = parseEther('500');
const tokens = treasuryAssets.sort();

await personaToken.burnAndClaim(burnAmount, tokens);

// 3. You receive proportional shares of all treasury assets`}</code></pre>
        </section>

        <section>
          <h2>Use Cases</h2>

          <h3>1. Exit Liquidity</h3>
          <p>
            Instead of selling on the market (which affects price), burn tokens to redeem
            underlying value directly from the treasury.
          </p>

          <h3>2. Portfolio Rebalancing</h3>
          <p>
            Burn some tokens to claim diverse treasury assets, effectively rebalancing
            your portfolio without market trades.
          </p>

          <h3>3. Treasury Arbitrage</h3>
          <p>
            If the market price is below the treasury backing value, you can buy tokens
            and burn them for a profit (helping restore peg).
          </p>

          <h3>4. Claiming Accumulated Value</h3>
          <p>
            As more assets flow into the treasury (fees, conversions, etc.), burning
            gives you access to that accumulated value.
          </p>
        </section>

        <section>
          <h2>Economic Implications</h2>

          <h3>For Token Holders</h3>
          <ul>
            <li><strong>Price Floor</strong>: Treasury value provides a fundamental price floor</li>
            <li><strong>No Slippage</strong>: Get exact proportional value, unlike market sells</li>
            <li><strong>Trustless</strong>: No governance or admin needed to redeem</li>
            <li><strong>Flexible</strong>: Choose which assets to claim</li>
          </ul>

          <h3>For Remaining Holders</h3>
          <ul>
            <li><strong>Supply Reduction</strong>: Total supply decreases, increasing scarcity</li>
            <li><strong>Concentrated Ownership</strong>: Each remaining token represents larger share</li>
            <li><strong>Self-Balancing</strong>: If price drops below backing, arbitrage burns tokens</li>
          </ul>

          <h3>For the Ecosystem</h3>
          <ul>
            <li><strong>Fair Exits</strong>: Anyone can leave without permission</li>
            <li><strong>Value Preservation</strong>: Treasury backing can&apos;t be stolen or mismanaged</li>
            <li><strong>Market Efficiency</strong>: Arbitrage keeps price aligned with backing</li>
          </ul>
        </section>

        <section>
          <h2>Security Considerations</h2>

          <h3>Contract Security</h3>
          <ul>
            <li><strong>Reentrancy Protection</strong>: All burn functions use ReentrancyGuard</li>
            <li><strong>CEI Pattern</strong>: State changes before external calls</li>
            <li><strong>No Admin Keys</strong>: Burn mechanism is fully trustless</li>
            <li><strong>Token Validation</strong>: Prevents zero address and invalid tokens</li>
          </ul>

          <h3>User Risks</h3>
          <div className="p-4 bg-yellow-500/10 backdrop-blur-sm rounded-lg border border-yellow-500/20 my-4">
            <p className="text-sm text-yellow-400 mb-2">
              ⚠️ Important Risks:
            </p>
            <ul className="text-sm text-yellow-300 space-y-1 ml-4">
              <li>Burning is permanent - you cannot reverse it</li>
              <li>Treasury assets may fluctuate in value</li>
              <li>Gas costs can be significant for claiming many tokens</li>
              <li>Market price may exceed treasury backing value</li>
              <li>Front-running risk: someone may burn before you</li>
            </ul>
          </div>

          <h3>Best Practices</h3>
          <ul>
            <li>Always check treasury balances before burning</li>
            <li>Calculate expected returns and compare to market price</li>
            <li>Sort token addresses correctly (ascending order)</li>
            <li>Use reasonable gas limits for multi-token claims</li>
            <li>Consider tax implications of burning vs selling</li>
          </ul>
        </section>

        <section>
          <h2>Mathematical Properties</h2>

          <h3>Proportional Distribution</h3>
          <p>The mechanism preserves fairness through proportional distribution:</p>
          <pre><code>{`If Alice owns 30% of supply and burns all her tokens:
- She receives 30% of all treasury assets
- Remaining holders now own proportionally more
- Total backing per token increases for remaining holders

Example with 3 holders:
Initial:
- Total Supply: 1000 tokens
- Treasury: 500 ETH
- Alice: 300 tokens (30%), Bob: 400 tokens (40%), Carol: 300 tokens (30%)

Alice burns all 300:
- Alice receives: 150 ETH (30% of 500)
- New supply: 700 tokens
- New treasury: 350 ETH
- Bob: 400 tokens (now 57% of supply)
- Carol: 300 tokens (now 43% of supply)
- Backing per token: 0.5 ETH/token → 0.5 ETH/token (unchanged!)`}</code></pre>

          <h3>Arbitrage Mechanics</h3>
          <p>The burn mechanism creates a price floor through arbitrage:</p>
          <pre><code>{`Market Price < Treasury Backing:
1. Arbitrageur buys tokens cheaply on market
2. Burns tokens to claim treasury assets
3. Sells treasury assets for profit
4. This reduces supply, increasing scarcity
5. Price returns to backing value

Market Price > Treasury Backing:
1. Holders keep tokens (no arbitrage opportunity)
2. New participants may prefer to buy on bonding curve
3. Treasury grows from fees and conversions
4. Backing value catches up to price`}</code></pre>
        </section>

        <section>
          <h2>Related Mechanisms</h2>
          <ul>
            <li><a href="/docs/aius-conversion" className="text-brand-blue hover:text-brand-cyan">AIUS to AMICA Conversion</a> - Converts AIUS to AMICA, adding to treasury</li>
            <li><a href="/docs/creating-personas" className="text-brand-blue hover:text-brand-cyan">Creating Personas</a> - Persona tokens also support burn & claim</li>
            <li><a href="/docs/token-launch" className="text-brand-blue hover:text-brand-cyan">Token Launch</a> - Understanding bonding curves and graduation</li>
          </ul>
        </section>

        <section>
          <h2>FAQs</h2>

          <h3>Can I un-burn tokens?</h3>
          <p>
            No, burning is permanent and irreversible. The tokens are destroyed forever and
            the total supply decreases. Make sure you want to exit before burning.
          </p>

          <h3>What if the treasury is empty?</h3>
          <p>
            If a treasury asset has zero balance, you simply won&apos;t receive any of that asset.
            The transaction will still succeed for any assets that do have balance.
          </p>

          <h3>Is there a minimum burn amount?</h3>
          <p>
            Technically no, but burning very small amounts may not be economical due to gas costs.
            The contract will revert if your burn amount is zero or if you don&apos;t receive any
            claimable assets.
          </p>
        </section>

        <section>
          <h2>Resources</h2>
          <ul>
            <li><a href="https://github.com/semperai/amica-personas/blob/main/contracts/src/BurnAndClaimBase.sol" target="_blank" rel="noopener noreferrer">BurnAndClaimBase.sol Contract</a></li>
            <li><a href="/docs/api-reference" className="text-brand-blue hover:text-brand-cyan">API Reference</a></li>
            <li><a href="/docs/security" className="text-brand-blue hover:text-brand-cyan">Security Best Practices</a></li>
            <li><a href="https://t.me/arbius_ai" target="_blank" rel="noopener noreferrer">Join Telegram</a></li>
          </ul>
        </section>
      </DocsPageLayout>
    </Layout>
  )
}
