'use client'

import Layout from '@/components/Layout'
import { DocsPageLayout } from './components/DocsPageLayout'
import { Button } from '@/components/Button'

export default function DocsPage() {
  return (
    <Layout>
      <DocsPageLayout>
        <h1>Welcome to Amica Personas Documentation</h1>

        <p className="lead">
          Amica Personas is a decentralized platform for launching AI personas with their own tokens on the blockchain.
        </p>

        <h2>What is Amica Personas?</h2>

        <p>
          Amica Personas enables anyone to create, launch, and trade AI personas as tokens. Each persona is unique,
          with its own personality, capabilities, and token that can be traded on decentralized exchanges.
        </p>

        <h2>AMICA Token Utility</h2>

        <p>
          Holding AMICA tokens gives you proportional ownership of every persona launched on the platform.
          33% of each persona&apos;s supply is distributed to AMICA holders, claimable anytime through the{' '}
          <a href="/docs/burn-and-claim" className="text-brand-blue hover:text-brand-cyan">Burn & Claim</a> mechanism.
          This creates continuous value accrual as new personas launch and gain traction.
        </p>

        <h2>Why Personas Matter</h2>

        <p>
          Personas make AI agents easier for humans to communicate with. By giving agents distinct personalities
          and visual identities, we create natural interfaces that are more relatable than faceless APIs.
          This helps build trust, set clear expectations, and makes AI interactions more human-friendly.
        </p>

        <h2>Key Features</h2>

        <ul>
          <li>
            <strong>Easy Persona Creation:</strong> Create AI personas with custom personalities and traits
          </li>
          <li>
            <strong>Token Launch:</strong> Launch ERC-20 tokens for your personas with built-in liquidity
          </li>
          <li>
            <strong>AMICA Holder Benefits:</strong> 33% of every persona launched goes to AMICA token holders, available through the <a href="/docs/burn-and-claim" className="text-brand-blue hover:text-brand-cyan">Burn & Claim</a> mechanism
          </li>
          <li>
            <strong>Decentralized Trading:</strong> Trade persona tokens on Uniswap and other DEXs
          </li>
          <li>
            <strong>Community Governance:</strong> Token holders can participate in persona development
          </li>
        </ul>

        <h2>Getting Started</h2>

        <p>
          Ready to create your first persona? Check out our <a href="/docs/getting-started">Getting Started</a> guide
          to learn how to connect your wallet and launch your first AI persona.
        </p>

        <div className="not-prose mt-8 p-4 bg-brand-blue/10 border border-brand-blue/20 rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-2">Need Help?</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Join our community on Telegram for support and updates.
          </p>
          <Button href="https://t.me/arbius_ai" external>
            Join Telegram
          </Button>
        </div>
      </DocsPageLayout>
    </Layout>
  )
}
