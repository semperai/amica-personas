'use client'

import Layout from '@/components/Layout'
import { DocsPageLayout } from '../components/DocsPageLayout'
import { Button } from '@/components/Button'

export default function TokenLaunchPage() {
  return (
    <Layout>
      <DocsPageLayout>
        <h1>Token Launch</h1>

        <p className="lead">
          Understand how token launches work on Amica Personas and how to maximize success.
        </p>

        <h2>How Token Launches Work</h2>

        <p>
          When you create a persona on Amica, a new ERC-20 token is automatically deployed and placed in a bonding curve.
          Only when enough liquidity has been raised does a Uniswap V4 pair get created, enabling full DEX trading.
        </p>

        <p>
          At launch, the creator receives an NFT and a subdomain at .amica.bot that allows them to customize their Amica persona.
        </p>

        <h2>Launch Process</h2>

        <h3>1. Contract Deployment</h3>

        <p>
          The persona smart contract is deployed to Arbitrum, containing:
        </p>

        <ul>
          <li>ERC-20 token implementation</li>
          <li>Metadata and configuration</li>
          <li>Trading and liquidity management logic</li>
        </ul>

        <h3>2. Token Minting</h3>

        <p>
          All personas mint a fixed supply of 1 billion tokens, distributed as:
        </p>

        <ul>
          <li><strong>Bonding Curve:</strong> 33% (333M) or 17% (167M) with agent token</li>
          <li><strong>Liquidity Pool:</strong> 33% (333M) - paired with the raising token at graduation</li>
          <li><strong>AMICA Holders:</strong> 33% (333M) - all AMICA token holders own proportional shares</li>
          <li><strong>Agent Rewards:</strong> 17% (167M) - only if agent token specified</li>
        </ul>

        <p>
          <strong>Important:</strong> Creators do NOT receive LP tokens. LP tokens remain locked in the protocol.
          The NFT owner receives trading fees from the Uniswap pool.
        </p>

        <h3>3. Graduation Process</h3>

        <p>
          Your persona &quot;graduates&quot; when 85% of bonding curve tokens are sold. Upon graduation:
        </p>

        <ul>
          <li>A Uniswap V4 pool is automatically created</li>
          <li>33% of supply paired with all raising tokens collected during bonding (AIUS, AMICA, EACC, or other supported tokens)</li>
          <li>Full range liquidity position created</li>
          <li>LP tokens remain locked in the protocol - NFT holder receives trading fees</li>
          <li>Users can claim their purchased tokens after a 24-hour delay</li>
        </ul>

        <h3>4. Market Phases</h3>

        <p>
          Persona tokens go through two phases:
        </p>

        <p><strong>Bonding Phase (Pre-Graduation):</strong></p>
        <ul>
          <li>Visible in the Amica marketplace</li>
          <li>Tradeable only through the bonding curve</li>
          <li>Prices follow a mathematical curve (pump.fun style)</li>
          <li>Continues until 85% of bonding supply is sold</li>
        </ul>

        <p><strong>Uniswap Phase (Post-Graduation):</strong></p>
        <ul>
          <li>Tradeable on Uniswap V4</li>
          <li>Standard DEX trading with full liquidity</li>
          <li>Users claim their bonding tokens after 24-hour delay</li>
        </ul>

        <h2>Pricing Mechanics</h2>

        <h3>Bonding Curve Pricing</h3>

        <p>
          Token price follows a bonding curve that increases as tokens are purchased:
        </p>

        <ul>
          <li>Uses constant product formula (x * y = k) with virtual reserves</li>
          <li>Price starts low and increases as more tokens are sold</li>
          <li>Price multiplier reaches approximately 233x at graduation (85% sold)</li>
          <li>Sell fee of 0.1% to prevent manipulation</li>
        </ul>

        <p>
          After graduation, price is determined by Uniswap V4 market dynamics based on the raising tokens collected during bonding.
        </p>

        <h3>Price Discovery</h3>

        <p>
          After launch, price is determined by:
        </p>

        <ul>
          <li>Supply and demand dynamics</li>
          <li>Trading volume and activity</li>
          <li>Market sentiment and speculation</li>
          <li>Persona utility and adoption</li>
        </ul>

        <h2>Post-Launch Management</h2>

        <h3>Community Building</h3>

        <p>
          Successful personas require active community engagement:
        </p>

        <ul>
          <li>Share your persona on social media</li>
          <li>Join the Amica <a href="https://t.me/arbius_ai" target="_blank" rel="noopener noreferrer">Telegram</a></li>
          <li>Engage with token holders</li>
          <li>Provide regular updates</li>
        </ul>

        <h3>Development & Utility</h3>

        <p>
          Increase your token&apos;s value by:
        </p>

        <ul>
          <li>Adding new capabilities to your persona</li>
          <li>Integrating with other platforms</li>
          <li>Creating use cases for the token</li>
          <li>Building partnerships</li>
        </ul>

        <h2>Common Pitfalls</h2>

        <div className="not-prose my-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-2">⚠️ Avoid These Mistakes</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Not buying any tokens during bonding (looks like you don&apos;t believe in it)</li>
            <li>Buying too much too fast (can trigger graduation before community forms)</li>
            <li>Lack of post-graduation engagement (token dies)</li>
            <li>No clear utility or purpose (pump and dump)</li>
            <li>Ignoring agent token mechanics (missed opportunity for value)</li>
          </ul>
        </div>

        <h2>Fees & Economics</h2>

        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr>
              <th className="text-left py-2 px-4 font-medium">Fee Type</th>
              <th className="text-left py-2 px-4 font-medium">Amount</th>
              <th className="text-left py-2 px-4 font-medium">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="py-2 px-4">Bonding Sell Fee</td>
              <td className="py-2 px-4">0.1%</td>
              <td className="py-2 px-4">Anti-manipulation fee</td>
            </tr>
            <tr>
              <td className="py-2 px-4">Uniswap Trading Fee</td>
              <td className="py-2 px-4">Dynamic</td>
              <td className="py-2 px-4">Set by dynamic fee hook</td>
            </tr>
            <tr>
              <td className="py-2 px-4">Gas Fee</td>
              <td className="py-2 px-4">~$0.10-0.50</td>
              <td className="py-2 px-4">Arbitrum transaction cost</td>
            </tr>
          </tbody>
        </table>

        <div className="not-prose mt-8 p-6 bg-gradient-to-r from-brand-blue/10 to-brand-cyan/10 border border-brand-blue/20 rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-2">Ready to launch?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your persona and launch your token today.
          </p>
          <Button href="/create">
            Launch Token
          </Button>
        </div>
      </DocsPageLayout>
    </Layout>
  )
}
