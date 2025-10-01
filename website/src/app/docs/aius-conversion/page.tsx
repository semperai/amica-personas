'use client'

import Layout from '@/components/Layout'
import { DocsPageLayout } from '../components/DocsPageLayout'

export default function AiusConversionPage() {
  return (
    <Layout>
      <DocsPageLayout>
        <h1>AIUS to AMICA Conversion</h1>
        <p className="lead">
          Convert your AIUS tokens to AMICA through the conversion contract
        </p>

        <section>
          <h2>Overview</h2>
        <p>
          The AIUS to AMICA conversion mechanism allows holders of AIUS tokens to convert them
          to AMICA tokens while simultaneously distributing the deposited AIUS to existing AMICA holders.
        </p>
        <p>
          This creates a win-win situation where:
        </p>
        <ul>
          <li>AIUS holders can migrate to the AMICA ecosystem</li>
          <li>Existing AMICA holders can burn AMICA to claim their share of AIUS</li>
          <li>New AMICA is minted while the backing value increases</li>
        </ul>
      </section>

      <section>
        <h2>How It Works</h2>

        <div className="p-4 bg-brand-blue/10 backdrop-blur-sm rounded-lg border border-brand-blue/20 my-4">
          <p className="text-sm text-brand-blue mb-2">
            💡 <strong>Convert Your AIUS:</strong>
          </p>
          <p className="text-sm">
            Visit the <a href="/convert" className="text-brand-blue hover:text-brand-cyan font-medium underline">AIUS to AMICA Converter</a> page to convert your tokens using our simple interface.
          </p>
        </div>

        <h3>Conversion Process</h3>
        <ol>
          <li><strong>Deposit AIUS</strong>: Send your AIUS tokens to the conversion contract</li>
          <li><strong>AIUS Added to Treasury</strong>: Your AIUS becomes part of the AMICA treasury backing</li>
          <li><strong>Mint AMICA</strong>: You receive newly minted AMICA tokens based on the fixed conversion rate</li>
          <li><strong>Burn & Claim</strong>: AMICA holders can burn AMICA to claim their proportional share of all treasury assets (including AIUS)</li>
        </ol>
      </section>

      <section>
        <h2>Contract Architecture</h2>

        <h3>Key Components</h3>
        <ul>
          <li><strong>Conversion Contract</strong>: Handles AIUS deposits and AMICA minting</li>
          <li><strong>Treasury</strong>: Holds all deposited AIUS as backing for AMICA</li>
          <li><strong>Burn & Claim Mechanism</strong>: Allows AMICA holders to burn tokens for proportional treasury assets</li>
        </ul>

        <p className="my-4">
          <strong>Note:</strong> This uses the same <a href="/docs/burn-and-claim" className="text-brand-blue hover:text-brand-cyan">Burn & Claim mechanism</a> used throughout the Amica ecosystem for redeeming underlying assets.
        </p>
      </section>

      <section>
        <h2>Economic Model</h2>

        <h3>Benefits for AIUS Holders</h3>
        <ul>
          <li>Access to the AMICA ecosystem and governance</li>
          <li>Participate in persona token launches</li>
          <li>Earn fees from protocol activity</li>
          <li>Potential for AMICA appreciation</li>
        </ul>

        <h3>Benefits for AMICA Holders</h3>
        <ul>
          <li>Treasury backing increases with each AIUS deposit</li>
          <li>Can burn AMICA anytime to claim proportional AIUS and other assets</li>
          <li>Increased value per AMICA token from stronger backing</li>
          <li>Diversified treasury reduces risk</li>
        </ul>

        <h3>Conversion Rate</h3>
        <p>
          The conversion rate determines how much AMICA you receive per AIUS deposited.
          The rate is <strong>fixed</strong> at any given time but may be adjusted by governance in the future
          based on market conditions and ecosystem needs.
        </p>
      </section>

      <section>
        <h2>Safety & Security</h2>

        <h3>Risks to Consider</h3>
        <div className="p-4 bg-yellow-500/10 backdrop-blur-sm rounded-lg border border-yellow-500/20 my-4">
          <p className="text-sm text-yellow-400 mb-2">
            ⚠️ Important Considerations:
          </p>
          <ul className="text-sm text-yellow-300 space-y-1 ml-4">
            <li>Conversion is one-way - you cannot convert AMICA back to AIUS</li>
            <li>The conversion rate is fixed once you submit</li>
            <li>Gas fees apply to both conversion and claiming</li>
            <li>Price of both tokens may fluctuate</li>
          </ul>
        </div>
      </section>

      <section>
        <h2>Example Scenario</h2>

        <div className="p-4 bg-muted rounded-lg border border-border my-4">
          <h4 className="font-semibold mb-2">Alice Converts 1000 AIUS</h4>
          <ul className="space-y-2 text-sm">
            <li><strong>Initial State:</strong></li>
            <li className="ml-4">• Total AMICA supply: 100,000 AMICA</li>
            <li className="ml-4">• Treasury AIUS: 0 AIUS</li>
            <li className="ml-4">• Conversion rate: 2 AMICA per AIUS</li>
            <li className="ml-4">• Bob holds: 10,000 AMICA (10% of supply)</li>

            <li className="mt-3"><strong>Alice Deposits 1000 AIUS:</strong></li>
            <li className="ml-4">• Alice receives: 2000 AMICA (minted)</li>
            <li className="ml-4">• 1000 AIUS added to AMICA treasury</li>
            <li className="ml-4">• New treasury backing: 1000 AIUS</li>

            <li className="mt-3"><strong>New State:</strong></li>
            <li className="ml-4">• Total AMICA supply: 102,000 AMICA</li>
            <li className="ml-4">• Treasury AIUS: 1000 AIUS</li>
            <li className="ml-4">• Alice: 2000 AMICA</li>
            <li className="ml-4">• Bob: 10,000 AMICA (now worth more due to treasury backing)</li>

            <li className="mt-3"><strong>Bob Burns to Claim AIUS:</strong></li>
            <li className="ml-4">• Bob burns: 10,200 AMICA (10% of new supply)</li>
            <li className="ml-4">• Bob receives: 100 AIUS (10% of treasury)</li>
            <li className="ml-4">• Bob&apos;s remaining: 0 AMICA + 100 AIUS</li>
          </ul>
        </div>
      </section>

      <section>
        <h2>Contract Addresses</h2>
        <div className="p-4 bg-blue-500/10 backdrop-blur-sm rounded-lg border border-blue-500/20 my-4">
          <p className="text-sm text-blue-400">
            ℹ️ Contract addresses will be published here upon deployment.
          </p>
        </div>

        <h3>Arbitrum</h3>
        <ul>
          <li><strong>Converter:</strong> <code>TBD</code></li>
          <li><strong>AIUS Token:</strong> <code>TBD</code></li>
          <li><strong>AMICA Token:</strong> <code>TBD</code></li>
        </ul>
      </section>

      <section>
        <h2>Resources</h2>
        <ul>
          <li><a href="/docs/api-reference" className="text-brand-blue hover:text-brand-cyan">API Reference</a></li>
          <li><a href="/docs/security" className="text-brand-blue hover:text-brand-cyan">Security Best Practices</a></li>
          <li><a href="https://github.com/semperai/amica-personas" target="_blank" rel="noopener noreferrer">GitHub Repository</a></li>
          <li><a href="https://t.me/arbius_ai" target="_blank" rel="noopener noreferrer">Join Telegram</a></li>
        </ul>
      </section>

      <section>
        <h2>FAQs</h2>

        <h3>Can I convert AMICA back to AIUS?</h3>
        <p>
          No, the conversion is one-way. Once you convert AIUS to AMICA, you cannot reverse the process
          through the converter. However, you can always trade your AMICA on secondary markets.
        </p>

        <h3>What happens to the AIUS I deposit?</h3>
        <p>
          Your deposited AIUS goes into the AMICA treasury, increasing the backing value of all AMICA tokens.
          AMICA holders must burn their tokens to claim proportional shares of treasury assets (including your AIUS).
        </p>

        <h3>Are there any fees?</h3>
        <p>
          The conversion itself does not charge protocol fees, but you will need to pay gas fees
          for the transactions. AMICA holders also pay gas fees when burning tokens to claim treasury assets.
        </p>
      </section>
      </DocsPageLayout>
    </Layout>
  )
}
