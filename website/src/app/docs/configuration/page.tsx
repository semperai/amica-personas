'use client'

import Layout from '@/components/Layout'
import { DocsPageLayout } from '../components/DocsPageLayout'
import { Button } from '@/components/Button'

export default function ConfigurationPage() {
  return (
    <Layout>
      <DocsPageLayout>
        <h1>Configuration</h1>

        <p className="lead">
          Advanced configuration options for Amica Personas.
        </p>

        <h2>Network Configuration</h2>

        <h3>Supported Networks</h3>

        <p>
          Amica Personas currently operates on:
        </p>

        <ul>
          <li><strong>Arbitrum One:</strong> Main production network</li>
          <li><strong>Arbitrum Sepolia:</strong> Testnet for development</li>
        </ul>

        <h3>Adding Arbitrum to Your Wallet</h3>

        <p>
          If your wallet doesn&apos;t have Arbitrum configured, add it manually:
        </p>

        <div className="not-prose my-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="text-left py-2 px-4 font-medium">Parameter</th>
                <th className="text-left py-2 px-4 font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-sm">
              <tr>
                <td className="py-2 px-4">Network Name</td>
                <td className="py-2 px-4">Arbitrum One</td>
              </tr>
              <tr>
                <td className="py-2 px-4">RPC URL</td>
                <td className="py-2 px-4">https://arb1.arbitrum.io/rpc</td>
              </tr>
              <tr>
                <td className="py-2 px-4">Chain ID</td>
                <td className="py-2 px-4">42161</td>
              </tr>
              <tr>
                <td className="py-2 px-4">Currency Symbol</td>
                <td className="py-2 px-4">ETH</td>
              </tr>
              <tr>
                <td className="py-2 px-4">Block Explorer</td>
                <td className="py-2 px-4">https://arbiscan.io</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>Wallet Configuration</h2>

        <h3>Supported Wallets</h3>

        <p>
          Amica supports all major Web3 wallets via RainbowKit:
        </p>

        <ul>
          <li>MetaMask</li>
          <li>Rainbow</li>
          <li>WalletConnect</li>
          <li>Coinbase Wallet</li>
          <li>Trust Wallet</li>
          <li>Ledger</li>
          <li>And many more...</li>
        </ul>

        <h3>Connection Settings</h3>

        <p>
          Your wallet connection is persisted locally. You can disconnect at any time by:
        </p>

        <ol>
          <li>Click your wallet address in the top right</li>
          <li>Select &quot;Disconnect&quot; from the dropdown</li>
        </ol>

        <h2>Gas Configuration</h2>

        <h3>Gas Settings</h3>

        <p>
          Arbitrum offers very low gas fees compared to Ethereum mainnet. Typical costs:
        </p>

        <ul>
          <li><strong>Token Creation:</strong> $0.10-0.50</li>
          <li><strong>Token Swap:</strong> $0.02-0.10</li>
          <li><strong>Add Liquidity:</strong> $0.05-0.20</li>
        </ul>

        <h3>Optimizing Gas Costs</h3>

        <p>
          To minimize gas fees:
        </p>

        <ul>
          <li>Batch multiple operations when possible</li>
          <li>Transact during off-peak hours (weekends, late night UTC)</li>
          <li>Use standard gas settings (avoid &quot;fast&quot; or &quot;instant&quot;)</li>
        </ul>

        <h2>Slippage Configuration</h2>

        <h3>What is Slippage?</h3>

        <p>
          Slippage is the difference between the expected price of a trade and the executed price.
          It occurs due to price movement between transaction submission and confirmation.
        </p>

        <h3>Recommended Settings</h3>

        <ul>
          <li><strong>High liquidity tokens:</strong> 0.5-1%</li>
          <li><strong>Medium liquidity:</strong> 1-3%</li>
          <li><strong>Low liquidity:</strong> 3-5%</li>
          <li><strong>Very new tokens:</strong> 5-10%</li>
        </ul>

        <div className="not-prose my-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            <strong>⚠️ Warning:</strong> High slippage settings can result in unfavorable trades. Only increase
            slippage if your transaction is failing due to price movement.
          </p>
        </div>

        <h2>Display Settings</h2>

        <h3>Theme</h3>

        <p>
          Amica automatically detects your system theme preference (light/dark mode). To change:
        </p>

        <ul>
          <li>Update your system theme settings</li>
          <li>The site will automatically switch themes</li>
        </ul>

        <h3>Token Display</h3>

        <p>
          Customize how tokens are displayed:
        </p>

        <ul>
          <li><strong>Decimal Places:</strong> Default 6 decimals</li>
          <li><strong>Price Format:</strong> USD equivalent shown when available</li>
          <li><strong>Chart Timeframe:</strong> Toggle between 1H, 24H, 7D, 30D</li>
        </ul>

        <h2>Privacy Settings</h2>

        <h3>Data Collection</h3>

        <p>
          Amica collects minimal data to improve the platform:
        </p>

        <ul>
          <li><strong>On-chain data:</strong> All transactions are public on Arbitrum</li>
          <li><strong>Analytics:</strong> Anonymous usage statistics</li>
          <li><strong>Local storage:</strong> Wallet connection, preferences</li>
        </ul>

        <h3>What We Don&apos;t Collect</h3>

        <ul>
          <li>Private keys or seed phrases</li>
          <li>Personal identification information</li>
          <li>Trading strategies or portfolio details</li>
          <li>Detailed browsing history</li>
        </ul>

        <h2>Advanced Settings</h2>

        <h3>RPC Endpoint</h3>

        <p>
          For advanced users, you can configure a custom RPC endpoint in your wallet settings.
          This can improve speed or reliability depending on your location.
        </p>

        <h3>MEV Protection</h3>

        <p>
          Consider using MEV protection services like:
        </p>

        <ul>
          <li>Flashbots Protect RPC</li>
          <li>Eden Network</li>
          <li>Private transaction pools</li>
        </ul>

        <div className="not-prose mt-8 p-4 bg-muted rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-2">Need More Help?</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Join our Telegram community for advanced configuration support.
          </p>
          <Button href="https://t.me/arbius_ai" external>
            Join Telegram
          </Button>
        </div>
      </DocsPageLayout>
    </Layout>
  )
}
