'use client'

import Layout from '@/components/Layout'
import { DocsPageLayout } from '../components/DocsPageLayout'
import { Button } from '@/components/Button'

export default function FaqPage() {
  return (
    <Layout>
      <DocsPageLayout>
        <h1>Frequently Asked Questions</h1>

        <p className="lead">
          Common questions about Amica Personas, answered.
        </p>

        <h2>General Questions</h2>

        <h3>What is Amica Personas?</h3>

        <p>
          Amica Personas is a decentralized platform that allows anyone to create, launch, and trade AI personas
          as tokens on the Arbitrum blockchain. Each persona has its own unique token that can be bought, sold,
          and traded on decentralized exchanges.
        </p>

        <h3>What blockchain does Amica use?</h3>

        <p>
          Amica operates on Arbitrum One, a Layer 2 scaling solution for Ethereum. Arbitrum offers fast
          transactions and low fees while maintaining Ethereum's security guarantees.
        </p>

        <h3>Do I need technical knowledge to use Amica?</h3>

        <p>
          No! Amica is designed to be user-friendly. If you can use a crypto wallet and make basic transactions,
          you can create and trade persona tokens. Our guides walk you through every step.
        </p>

        <h3>Is Amica open source?</h3>

        <p>
          Yes, Amica is open source. You can view and contribute to the code on{' '}
          <a href="https://github.com/semperai/amica-personas" target="_blank" rel="noopener noreferrer">GitHub</a>.
        </p>

        <h2>Getting Started</h2>

        <h3>What wallet do I need?</h3>

        <p>
          Any Web3 wallet that supports Arbitrum works with Amica. Popular options include MetaMask, Rainbow,
          WalletConnect, Coinbase Wallet, and hardware wallets like Ledger.
        </p>

        <h3>How do I get ETH on Arbitrum?</h3>

        <p>
          You can bridge ETH from Ethereum mainnet to Arbitrum using the{' '}
          <a href="https://bridge.arbitrum.io" target="_blank" rel="noopener noreferrer">official Arbitrum bridge</a>,
          or buy ETH directly on Arbitrum from exchanges that support withdrawals to Arbitrum (Binance, Coinbase, etc.).
        </p>

        <h3>How much does it cost to create a persona?</h3>

        <p>
          Creating a persona requires:
        </p>

        <ul>
          <li>Mint cost: Varies by pairing token (check current rates)</li>
          <li>Initial purchase: Optional - you can buy tokens during creation</li>
          <li>Gas fees: ~$0.10-0.50 on Arbitrum (very low)</li>
        </ul>

        <p>
          Note: There is no traditional "initial liquidity" parameter. Liquidity is created automatically at graduation.
        </p>

        <h2>Creating Personas</h2>

        <h3>Can I change my persona after creation?</h3>

        <p>
          Basic information (name, symbol, initial supply) cannot be changed as they're permanently stored in the
          smart contract. However, metadata like description and images can be updated through the platform.
        </p>

        <h3>What happens to my initial liquidity?</h3>

        <p>
          Your initial liquidity is used to create a Uniswap V3 pool pairing your persona token with ETH. You
          receive LP (Liquidity Provider) tokens representing your position, which earn trading fees and can be
          withdrawn at any time.
        </p>

        <h3>Can I create multiple personas?</h3>

        <p>
          Yes! There's no limit to how many personas you can create. Each persona is independent with its own
          token and liquidity pool.
        </p>

        <h3>What makes a good persona?</h3>

        <p>
          Successful personas typically have:
        </p>

        <ul>
          <li>Clear purpose and utility</li>
          <li>Unique personality and characteristics</li>
          <li>Sufficient initial liquidity ($100+ recommended)</li>
          <li>Active creator engagement</li>
          <li>Strong community building</li>
          <li>Regular updates and development</li>
        </ul>

        <h2>Trading & Tokens</h2>

        <h3>Where can I trade persona tokens?</h3>

        <p>
          Persona tokens are standard ERC-20 tokens that can be traded:
        </p>

        <ul>
          <li>On Amica's built-in trading interface</li>
          <li>Directly on Uniswap V3</li>
          <li>Through any DEX aggregator (1inch, Paraswap, etc.)</li>
          <li>On any platform that supports Arbitrum ERC-20s</li>
        </ul>

        <h3>What is slippage?</h3>

        <p>
          Slippage is the difference between the expected price of your trade and the actual executed price.
          It occurs when the price moves between when you submit and when your transaction confirms. Set higher
          slippage (3-5%) for low-liquidity tokens.
        </p>

        <h3>Why did my transaction fail?</h3>

        <p>
          Common reasons for failed transactions:
        </p>

        <ul>
          <li>Insufficient slippage tolerance</li>
          <li>Not enough ETH for gas fees</li>
          <li>Token price moved significantly</li>
          <li>Transaction deadline expired</li>
          <li>Network congestion</li>
        </ul>

        <h3>Can I see token price history?</h3>

        <p>
          Yes, each persona page shows price charts with historical data. You can also view detailed analytics
          on Arbiscan or DEX analytics sites like Dexscreener.
        </p>

        <h2>Liquidity & Earnings</h2>

        <h3>What are LP tokens?</h3>

        <p>
          LP (Liquidity Provider) tokens represent your share of a liquidity pool. When you create a persona,
          you receive LP tokens for the initial liquidity you provide. These LP tokens:
        </p>

        <ul>
          <li>Earn you a share of all trading fees (0.3% per trade)</li>
          <li>Can be used to withdraw your liquidity</li>
          <li>Are transferable (can be sold or gifted)</li>
        </ul>

        <h3>How do I earn from my persona?</h3>

        <p>
          As a persona creator, you earn through:
        </p>

        <ul>
          <li><strong>Token allocation:</strong> You receive a percentage of tokens at creation</li>
          <li><strong>Trading fees:</strong> Your LP position earns 0.3% of all trades</li>
          <li><strong>Token appreciation:</strong> If your persona succeeds, your tokens increase in value</li>
        </ul>

        <h3>Should I remove my liquidity?</h3>

        <p>
          Removing liquidity immediately after creation is generally discouraged as it:
        </p>

        <ul>
          <li>Damages trust in your persona</li>
          <li>Makes trading difficult for others</li>
          <li>Can be seen as a "rugpull"</li>
          <li>Stops you from earning trading fees</li>
        </ul>

        <p>
          Consider locking liquidity or keeping it for at least several weeks to build credibility.
        </p>

        <h2>Technical Questions</h2>

        <h3>Are the smart contracts audited?</h3>

        <p>
          The contracts have undergone internal security reviews and are built using OpenZeppelin's audited
          libraries. A third-party audit is planned for Q2 2025. See the{' '}
          <a href="/docs/security">Security</a> page for details.
        </p>

        <h3>Can I integrate Amica into my own app?</h3>

        <p>
          Yes! Amica provides both GraphQL and REST APIs for developers. Check the{' '}
          <a href="/docs/api-reference">API Reference</a> for documentation. All smart contracts are
          verified on Arbiscan and can be integrated directly.
        </p>

        <h3>What if I find a bug?</h3>

        <p>
          Please report bugs through:
        </p>

        <ul>
          <li>GitHub Issues for UI/UX bugs</li>
          <li>Email security@amica.arbius.ai for security vulnerabilities</li>
          <li>Telegram for general issues</li>
        </ul>

        <p>
          Critical security issues may be eligible for bug bounties up to $10,000.
        </p>

        <h2>Fees & Costs</h2>

        <h3>What fees does Amica charge?</h3>

        <ul>
          <li><strong>Creation fee:</strong> 1% of initial liquidity</li>
          <li><strong>Trading fee:</strong> None (0.3% goes to Uniswap LPs)</li>
          <li><strong>Withdrawal fee:</strong> None</li>
        </ul>

        <h3>How are gas fees calculated?</h3>

        <p>
          Gas fees are paid in ETH to Arbitrum validators for processing transactions. Amica doesn't control
          gas prices. Fees vary based on network congestion but are typically $0.02-$0.50 per transaction on Arbitrum - much cheaper than Ethereum mainnet.
        </p>

        <h2>Support & Community</h2>

        <h3>How do I get help?</h3>

        <p>
          For support:
        </p>

        <ul>
          <li>Read our comprehensive <a href="/docs">Documentation</a></li>
          <li>Join our <a href="https://t.me/arbius_ai" target="_blank" rel="noopener noreferrer">Telegram</a> community</li>
          <li>Check <a href="https://github.com/semperai/amica-personas" target="_blank" rel="noopener noreferrer">GitHub</a> for technical issues</li>
        </ul>

        <div className="not-prose my-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            <strong>⚠️ Warning:</strong> Amica team will NEVER DM you first. Beware of impersonators
            asking for private keys or seed phrases.
          </p>
        </div>

        <h3>Where can I follow Amica updates?</h3>

        <ul>
          <li>Telegram: <a href="https://t.me/arbius_ai" target="_blank" rel="noopener noreferrer">t.me/arbius_ai</a></li>
          <li>GitHub: <a href="https://github.com/semperai/amica-personas" target="_blank" rel="noopener noreferrer">github.com/semperai/amica-personas</a></li>
        </ul>

        <h3>Can I contribute to Amica?</h3>

        <p>
          Absolutely! Amica is open source and community-driven. Ways to contribute:
        </p>

        <ul>
          <li>Code: Submit PRs on GitHub</li>
          <li>Documentation: Improve guides and docs</li>
          <li>Community: Help others in Telegram</li>
          <li>Design: Create personas and share ideas</li>
          <li>Testing: Report bugs and test new features</li>
        </ul>

        <div className="not-prose mt-8 p-6 bg-gradient-to-r from-brand-blue/10 to-brand-cyan/10 border border-brand-blue/20 rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-2">Still have questions?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Join our community and ask anything!
          </p>
          <Button href="https://t.me/arbius_ai" external>
            Join Telegram
          </Button>
        </div>
      </DocsPageLayout>
    </Layout>
  )
}
