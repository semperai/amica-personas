'use client'

import Layout from '@/components/Layout'
import { DocsPageLayout } from '../components/DocsPageLayout'
import { Button } from '@/components/Button'

export default function CreatingPersonasPage() {
  return (
    <Layout>
      <DocsPageLayout>
        <h1>Creating Personas</h1>

        <p className="lead">
          Learn how to create and customize your own AI personas on Amica.
        </p>

        <h2>Overview</h2>

        <p>
          Creating a persona on Amica involves designing a unique AI agent with its own personality, capabilities,
          and token. Each persona is deployed as a smart contract on Arbitrum, with an associated ERC-20 token.
        </p>

        <h2>Persona Components</h2>

        <p>
          A complete persona consists of several key components:
        </p>

        <h3>1. Basic Information</h3>

        <ul>
          <li><strong>Domain:</strong> Unique subdomain at .amica.bot (like ENS for AI agents, e.g., "myagent.amica.bot")</li>
          <li><strong>Name:</strong> Display name for your persona (3-32 characters)</li>
          <li><strong>Symbol:</strong> Token ticker symbol (2-8 characters)</li>
          <li><strong>Description:</strong> Brief description of your persona's purpose and personality</li>
          <li><strong>Avatar:</strong> Visual representation of your persona (image/NFT)</li>
        </ul>

        <div className="not-prose my-6 p-4 bg-brand-blue/10 border border-brand-blue/20 rounded-lg">
          <h4 className="text-sm font-semibold text-foreground mb-2">📝 Domain System</h4>
          <p className="text-sm text-muted-foreground">
            Amica uses an ENS-like domain system for AI agent personas. Each persona gets a unique subdomain
            at .amica.bot (e.g., "assistant.amica.bot") that serves as its identity. Domains must start with a letter, can contain
            letters, numbers, and hyphens, and must end with a letter or number. Like ENS, domains are unique
            and permanent once registered.
          </p>
        </div>

        <h3>2. Token Configuration</h3>

        <ul>
          <li><strong>Total Supply:</strong> Fixed at 1 billion tokens</li>
          <li><strong>Initial Purchase:</strong> Optional amount to buy during creation</li>
          <li><strong>Agent Token:</strong> Optional token for staking requirements</li>
        </ul>

        <h3>3. Metadata & Customization</h3>

        <p>
          Personas support a comprehensive metadata system that allows for full customization of your AI agent's
          characteristics, capabilities, and behavior. The metadata can include:
        </p>

        <ul>
          <li><strong>Visual Identity:</strong> Avatar, background images, color schemes</li>
          <li><strong>Personality Traits:</strong> Behavioral characteristics and interaction style</li>
          <li><strong>Capabilities:</strong> Skills, tools, and services your persona provides</li>
          <li><strong>Integration Data:</strong> Arbius model addresses, API endpoints, service URLs</li>
          <li><strong>Social Links:</strong> Website, documentation, community channels</li>
          <li><strong>Custom Fields:</strong> Any additional data needed for your use case</li>
        </ul>

        <p>
          This flexible metadata system enables personas to represent any type of AI agent, from simple chatbots
          to complex autonomous agents with multiple integrations and capabilities.
        </p>

        <h2>Step-by-Step Creation Process</h2>

        <h3>Step 1: Navigate to Create Page</h3>

        <p>
          Visit the <a href="/create">Create</a> page and ensure your wallet is connected to Arbitrum.
        </p>

        <h3>Step 2: Fill in Basic Details</h3>

        <p>
          Enter your persona's name, symbol, and description. Choose these carefully as they cannot be changed
          after deployment.
        </p>

        <div className="not-prose my-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            <strong>⚠️ Important:</strong> Persona names and symbols are permanent. Double-check spelling and formatting before proceeding.
          </p>
        </div>

        <h3>Step 3: Configure Token Distribution</h3>

        <p>
          All personas have a fixed supply of 1 billion tokens, distributed as follows:
        </p>

        <ul>
          <li><strong>Bonding Curve:</strong> 33% (333M tokens) available for purchase</li>
          <li><strong>Liquidity Pool:</strong> 33% (333M tokens) paired with raising token at graduation</li>
          <li><strong>AMICA Holders:</strong> 33% (333M tokens) - all AMICA token holders own a proportional share of every persona launched on the platform</li>
        </ul>

        <p>
          If you specify an agent token requirement, distribution changes to:
        </p>

        <ul>
          <li><strong>Bonding Curve:</strong> 17% (167M tokens)</li>
          <li><strong>Liquidity Pool:</strong> 33% (333M tokens)</li>
          <li><strong>AMICA Holders:</strong> 33% (333M tokens) - proportional ownership for all AMICA token holders</li>
          <li><strong>Agent Rewards:</strong> 17% (167M tokens) for stakers</li>
        </ul>

        <h3>Step 4: Customize Appearance</h3>

        <p>
          Upload a VRM avatar for your persona. VRM is a 3D avatar format that allows for rich, interactive representations.
        </p>

        <p>
          You can create your own VRM avatar using:
        </p>

        <ul>
          <li><strong><a href="https://vroid.com/en/studio" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:text-brand-cyan">VRoid Studio</a>:</strong> Free avatar creation tool with intuitive customization options</li>
          <li><strong><a href="https://www.blender.org/" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:text-brand-cyan">Blender</a>:</strong> Professional 3D modeling software with VRM export capabilities</li>
        </ul>

        <h3>Step 5: Configure Metadata</h3>

        <p>
          Set key-value pairs for metadata that will be loaded by the Amica interface. This metadata system
          allows you to customize all aspects of your persona's behavior, appearance, and capabilities.
        </p>

        <p>
          After deployment, you receive an NFT that grants you the ability to modify these metadata traits
          at any time, allowing your persona to evolve and improve post-launch.
        </p>

        <h3>Step 6: Review and Deploy</h3>

        <p>
          Review all parameters carefully. Once you confirm:
        </p>

        <ol>
          <li>The smart contract will be deployed</li>
          <li>Tokens will be minted</li>
          <li>Liquidity pool will be created on Uniswap V3</li>
          <li>Your persona will appear in the marketplace</li>
        </ol>

        <h2>Best Practices</h2>

        <h3>Naming</h3>

        <ul>
          <li>Choose memorable, unique names</li>
          <li>Avoid trademarked or offensive terms</li>
          <li>Keep symbols short and recognizable</li>
        </ul>

        <h3>Tokenomics</h3>

        <ul>
          <li>Total supply is fixed at 1 billion tokens for all personas</li>
          <li>Initial ETH raised during bonding phase determines liquidity depth</li>
          <li>LP tokens remain locked - the NFT owner receives fees from trading on Uniswap</li>
          <li>Consider using agent tokens for additional value capture</li>
        </ul>

        <h3>Description & Personality</h3>

        <ul>
          <li>Be clear about your persona's purpose</li>
          <li>Highlight unique features or capabilities</li>
          <li>Use engaging, professional language</li>
        </ul>

        <h2>Costs</h2>

        <p>
          Creating a persona requires:
        </p>

        <ul>
          <li><strong>Initial purchase:</strong> Optional amount to buy tokens (minimum 0)</li>
          <li><strong>Gas fees:</strong> ~$0.10-0.50 on Arbitrum (typically very low)</li>
        </ul>

        <p>
          Note: There is no "initial liquidity" parameter. Liquidity is created at graduation using ETH collected during the bonding phase.
        </p>

        <div className="not-prose mt-8 p-6 bg-gradient-to-r from-brand-blue/10 to-brand-cyan/10 border border-brand-blue/20 rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-2">Ready to create?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Launch your AI persona and join the Amica ecosystem.
          </p>
          <Button href="/create">
            Create Persona
          </Button>
        </div>
      </DocsPageLayout>
    </Layout>
  )
}
