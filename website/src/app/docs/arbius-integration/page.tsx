'use client'

import Layout from '@/components/Layout'
import { DocsPageLayout } from '../components/DocsPageLayout'

export default function ArbiusIntegrationPage() {
  return (
    <Layout>
      <DocsPageLayout>
        <h1>Arbius Integration</h1>
        <p className="lead">
          Connect your Arbius AI models with Amica Personas to monetize inference
        </p>

        <section>
          <h2>Overview</h2>
        <p>
          Arbius is a decentralized AI inference network that enables running AI models on-chain.
          By integrating your Arbius models with Amica Personas, inference fees automatically flow
          into your persona token treasury, creating value for all token holders.
        </p>
      </section>

      <section>
        <h2>Integration Flow</h2>
        <p>
          Follow these steps to connect your AI model with Amica Personas:
        </p>

        <h3>1. Launch Your Persona</h3>
        <p>
          First, create your persona token on the Amica platform. Visit the <a href="/create" className="text-brand-blue hover:text-brand-cyan">Create</a> page
          and fill in your persona details including name, symbol, and description.
        </p>
        <p>
          Once deployed, you&apos;ll receive a persona token address that will be used to link your Arbius model.
        </p>

        <h3>2. Configure Persona to Demo Your Model</h3>
        <p>
          Add metadata to your persona that demonstrates what your AI model can do. This helps users
          understand the capabilities and value proposition of your model.
        </p>
        <p>
          Include in your persona metadata:
        </p>
        <ul>
          <li><strong>Model description</strong>: What tasks can your AI perform?</li>
          <li><strong>Example outputs</strong>: Show sample results from your model</li>
          <li><strong>Use cases</strong>: Explain practical applications</li>
          <li><strong>Pricing</strong>: How much does inference cost?</li>
        </ul>

        <h3>3. Launch Arbius Model Referencing Persona Token</h3>
        <p>
          Deploy or configure your model on the Arbius network with your persona token address.
          This establishes the connection between inference activity and your persona treasury.
        </p>
        <p>
          When registering your Arbius model, specify:
        </p>
        <ul>
          <li><strong>Persona Token Address</strong>: The address of your Amica persona token</li>
          <li><strong>Fee Structure</strong>: How much to charge per inference</li>
          <li><strong>Model Parameters</strong>: Configuration for your AI model</li>
        </ul>

        <h3>4. Arbius Model Fees Flow Into Persona Token</h3>
        <p>
          When users pay for inference on your Arbius model, those fees automatically flow into
          your persona token treasury. This increases the backing value of your persona tokens.
        </p>
        <p>
          All token holders benefit from:
        </p>
        <ul>
          <li>Increased treasury value from inference fees</li>
          <li>Ability to redeem their share via <a href="/docs/burn-and-claim" className="text-brand-blue hover:text-brand-cyan">Burn & Claim</a></li>
          <li>Higher floor price as treasury grows</li>
        </ul>

        <h3>5. Users Can Add Fees Through Usage</h3>
        <p>
          Beyond Arbius inference fees, users who interact with your persona through other channels
          can also contribute fees to the treasury. This creates multiple revenue streams:
        </p>
        <ul>
          <li><strong>Direct Inference</strong>: Fees from Arbius model usage</li>
          <li><strong>Tipping</strong>: Users can send tokens directly to the persona treasury</li>
          <li><strong>Service Fees</strong>: Custom integrations can route fees to your persona</li>
          <li><strong>Subscription Revenue</strong>: Recurring payments for premium features</li>
        </ul>

        <h3>6. Reward Distribution</h3>
        <p>
          All fees collected by your persona token go directly into the persona token treasury.
          There are no protocol fees on inference or usage.
        </p>
        <p>
          <strong>Any holder</strong> of your persona token can redeem their proportional share of the treasury
          at any time using the <a href="/docs/burn-and-claim" className="text-brand-blue hover:text-brand-cyan">Burn & Claim</a> mechanism:
        </p>
        <ul>
          <li>Burn your persona tokens</li>
          <li>Receive proportional share of all treasury assets</li>
          <li>No permission needed - fully trustless</li>
        </ul>
        <p>
          This creates a fair, transparent distribution where token holders directly benefit from
          your model&apos;s success.
        </p>
      </section>

      <section>
        <h2>What is Arbius?</h2>
        <p>
          Arbius is a decentralized machine learning network where anyone can create, share, and use AI models.
          It provides on-chain inference for various AI tasks including:
        </p>
        <ul>
          <li>Text generation (LLMs)</li>
          <li>Image generation (Stable Diffusion)</li>
          <li>Audio generation</li>
          <li>Custom model hosting</li>
        </ul>
      </section>

      <section>
        <h2>Benefits</h2>

        <h3>For Model Creators</h3>
        <ul>
          <li>Monetize your AI models through inference fees</li>
          <li>Build a token economy around your model</li>
          <li>Attract early supporters who benefit from model success</li>
          <li>No platform fees - all revenue goes to your treasury</li>
        </ul>

        <h3>For Token Holders</h3>
        <ul>
          <li>Earn from inference fees as treasury grows</li>
          <li>Redeem your share anytime via Burn & Claim</li>
          <li>Benefit from multiple revenue streams</li>
          <li>Support AI models you believe in</li>
        </ul>
      </section>

      <section>
        <h2>Resources</h2>
        <ul>
          <li><a href="https://arbius.ai" target="_blank" rel="noopener noreferrer">Arbius Website</a></li>
          <li><a href="https://docs.arbius.ai" target="_blank" rel="noopener noreferrer">Arbius Documentation</a></li>
          <li><a href="https://github.com/semperai/arbius" target="_blank" rel="noopener noreferrer">Arbius GitHub</a></li>
          <li><a href="/docs/burn-and-claim" className="text-brand-blue hover:text-brand-cyan">Burn & Claim Mechanism</a></li>
          <li><a href="https://t.me/arbius_ai" target="_blank" rel="noopener noreferrer">Join Arbius Telegram</a></li>
        </ul>
      </section>

      <section>
        <h2>Next Steps</h2>
        <ol>
          <li><a href="/create" className="text-brand-blue hover:text-brand-cyan">Create your persona</a> on the Amica platform</li>
          <li>Configure your persona metadata to showcase your model</li>
          <li>Deploy your model on Arbius with your persona token address</li>
          <li>Share your persona with the community</li>
          <li>Watch as inference fees grow your treasury</li>
        </ol>
      </section>
      </DocsPageLayout>
    </Layout>
  )
}
