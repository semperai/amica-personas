'use client'

import Layout from '@/components/Layout'
import { DocsPageLayout } from '../components/DocsPageLayout'
import { Button } from '@/components/Button'

export default function GettingStartedPage() {
  return (
    <Layout>
      <DocsPageLayout>
        <h1>Getting Started</h1>

        <p className="lead">
          Learn how to connect your wallet and start creating AI personas on Amica.
        </p>

        <h2>Prerequisites</h2>

        <p>
          Before you begin, make sure you have the following:
        </p>

        <ul>
          <li>A Web3 wallet (MetaMask, Rainbow, or similar)</li>
          <li>ETH on Arbitrum for gas fees</li>
          <li>Basic understanding of blockchain transactions</li>
        </ul>

        <h2>Step 1: Connect Your Wallet</h2>

        <p>
          Click the "Connect Wallet" button in the top right corner of the page. Select your preferred wallet provider
          and authorize the connection.
        </p>

        <div className="not-prose my-6 p-4 bg-muted rounded-lg border border-border">
          <p className="text-sm text-muted-foreground mb-2">
            <strong>Note:</strong> Amica Personas runs on Arbitrum. Make sure your wallet is connected to the Arbitrum network.
          </p>
        </div>

        <h2>Step 2: Explore Existing Personas</h2>

        <p>
          Browse the <a href="/">Explore</a> page to see existing AI personas. You can:
        </p>

        <ul>
          <li>View persona details and descriptions</li>
          <li>Check token prices and market data</li>
          <li>Trade persona tokens</li>
        </ul>

        <h2>Step 3: Create Your First Persona</h2>

        <p>
          Navigate to the <a href="/create">Create</a> page to launch your own AI persona:
        </p>

        <ol>
          <li>Choose a unique subdomain at .amica.bot for your persona</li>
          <li>Set name, symbol, and description</li>
          <li>Upload VRM avatar and add metadata</li>
          <li>Review and confirm the transaction</li>
        </ol>

        <h2>Step 4: Manage Your Portfolio</h2>

        <p>
          Once you've created or purchased persona tokens, visit your <a href="/portfolio">Portfolio</a> to:
        </p>

        <ul>
          <li>Track your persona token holdings</li>
          <li>Monitor performance and analytics</li>
          <li>View created personas and trading fees (if you own the NFT)</li>
          <li>Claim treasury assets via Burn & Claim</li>
        </ul>

        <h2>Need Help?</h2>

        <p>
          If you run into any issues, join our community on{' '}
          <a href="https://t.me/arbius_ai" target="_blank" rel="noopener noreferrer">Telegram</a> for support.
        </p>

        <div className="not-prose mt-8 p-6 bg-gradient-to-r from-brand-blue/10 to-brand-cyan/10 border border-brand-blue/20 rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-2">Ready to get started?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Connect your wallet and create your first AI persona today.
          </p>
          <div className="flex gap-3">
            <Button href="/create">
              Create Persona
            </Button>
            <Button href="/" variant="secondary">
              Explore Personas
            </Button>
          </div>
        </div>
      </DocsPageLayout>
    </Layout>
  )
}
