'use client'

import Layout from '@/components/Layout'
import { DocsPageLayout } from '../components/DocsPageLayout'
import { Button } from '@/components/Button'

export default function ApiReferencePage() {
  return (
    <Layout>
      <DocsPageLayout>
        <h1>API Reference</h1>

        <p className="lead">
          Technical documentation for interacting with Amica Personas smart contracts and APIs.
        </p>

        <h2>Smart Contracts</h2>

        <h3>Core Contracts</h3>

        <p>
          Amica Personas consists of several key smart contracts deployed on Arbitrum:
        </p>

        <div className="not-prose my-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr>
                <th className="text-left py-2 px-4 font-medium">Contract</th>
                <th className="text-left py-2 px-4 font-medium">Address</th>
                <th className="text-left py-2 px-4 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              <tr>
                <td className="py-2 px-4 font-medium">PersonaFactory</td>
                <td className="py-2 px-4 font-mono text-xs">0x...</td>
                <td className="py-2 px-4">Creates new personas</td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-medium">PersonaToken</td>
                <td className="py-2 px-4 font-mono text-xs">0x...</td>
                <td className="py-2 px-4">ERC-20 token template</td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-medium">PersonaRegistry</td>
                <td className="py-2 px-4 font-mono text-xs">0x...</td>
                <td className="py-2 px-4">Tracks all personas</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>PersonaFactory</h2>

        <h3>createPersona</h3>

        <p>
          Creates a new persona with associated token and liquidity pool.
        </p>

        <div className="not-prose my-6 p-4 bg-muted rounded-lg">
          <pre className="text-sm overflow-x-auto"><code>{`function createPersona(
    string memory name,
    string memory symbol,
    string memory description,
    uint256 initialSupply,
    uint256 creatorAllocation
) external payable returns (address personaAddress)`}</code></pre>
        </div>

        <p><strong>Parameters:</strong></p>

        <ul>
          <li><code>name</code>: Persona name (3-32 characters)</li>
          <li><code>symbol</code>: Token symbol (2-8 characters)</li>
          <li><code>description</code>: Persona description (max 500 characters)</li>
          <li><code>initialSupply</code>: Total token supply</li>
          <li><code>creatorAllocation</code>: Percentage allocated to creator (0-20)</li>
        </ul>

        <p><strong>Returns:</strong></p>

        <ul>
          <li><code>personaAddress</code>: Address of deployed persona contract</li>
        </ul>

        <p><strong>Events:</strong></p>

        <div className="not-prose my-6 p-4 bg-muted rounded-lg">
          <pre className="text-sm overflow-x-auto"><code>{`event PersonaCreated(
    address indexed personaAddress,
    address indexed creator,
    string name,
    string symbol,
    uint256 initialSupply
)`}</code></pre>
        </div>

        <h2>PersonaToken</h2>

        <h3>Standard ERC-20 Methods</h3>

        <p>
          Each persona token implements the standard ERC-20 interface:
        </p>

        <div className="not-prose my-6 p-4 bg-muted rounded-lg">
          <pre className="text-sm overflow-x-auto"><code>{`// Standard ERC-20 functions
function balanceOf(address account) external view returns (uint256)
function transfer(address to, uint256 amount) external returns (bool)
function approve(address spender, uint256 amount) external returns (bool)
function transferFrom(address from, address to, uint256 amount) external returns (bool)
function allowance(address owner, address spender) external view returns (uint256)

// Standard ERC-20 views
function name() external view returns (string memory)
function symbol() external view returns (string memory)
function decimals() external view returns (uint8)
function totalSupply() external view returns (uint256)`}</code></pre>
        </div>

        <h3>Custom Methods</h3>

        <h4>getPersonaInfo</h4>

        <p>
          Returns metadata about the persona.
        </p>

        <div className="not-prose my-6 p-4 bg-muted rounded-lg">
          <pre className="text-sm overflow-x-auto"><code>{`function getPersonaInfo() external view returns (
    string memory name,
    string memory symbol,
    string memory description,
    address creator,
    uint256 createdAt,
    address liquidityPool
)`}</code></pre>
        </div>

        <h2>GraphQL API</h2>

        <h3>Endpoint</h3>

        <p>
          Query persona data using our GraphQL API powered by The Graph:
        </p>

        <div className="not-prose my-6 p-4 bg-muted rounded-lg font-mono text-sm">
          https://api.thegraph.com/subgraphs/name/amica/personas
        </div>

        <h3>Example Queries</h3>

        <h4>Get All Personas</h4>

        <div className="not-prose my-6 p-4 bg-muted rounded-lg">
          <pre className="text-sm overflow-x-auto"><code>{`query {
  personas(first: 10, orderBy: createdAt, orderDirection: desc) {
    id
    name
    symbol
    description
    creator
    totalSupply
    liquidityPool
    createdAt
  }
}`}</code></pre>
        </div>

        <h4>Get Persona by Address</h4>

        <div className="not-prose my-6 p-4 bg-muted rounded-lg">
          <pre className="text-sm overflow-x-auto"><code>{`query {
  persona(id: "0x...") {
    id
    name
    symbol
    description
    creator
    totalSupply
    holders {
      address
      balance
    }
    transactions {
      hash
      from
      to
      amount
      timestamp
    }
  }
}`}</code></pre>
        </div>

        <h4>Get User's Personas</h4>

        <div className="not-prose my-6 p-4 bg-muted rounded-lg">
          <pre className="text-sm overflow-x-auto"><code>{`query {
  user(id: "0x...") {
    createdPersonas {
      id
      name
      symbol
      totalSupply
    }
    holdings {
      persona {
        id
        name
        symbol
      }
      balance
    }
  }
}`}</code></pre>
        </div>

        <h2>REST API</h2>

        <h3>Base URL</h3>

        <div className="not-prose my-6 p-4 bg-muted rounded-lg font-mono text-sm">
          https://api.amica.arbius.ai
        </div>

        <h3>Endpoints</h3>

        <h4>GET /personas</h4>

        <p>
          Retrieve list of all personas with optional filtering.
        </p>

        <div className="not-prose my-6 p-4 bg-muted rounded-lg">
          <pre className="text-sm overflow-x-auto"><code>{`GET /personas?limit=10&offset=0&sortBy=createdAt&order=desc

Response:
{
  "personas": [
    {
      "address": "0x...",
      "name": "Example Persona",
      "symbol": "EXAMPLE",
      "creator": "0x...",
      "totalSupply": "1000000",
      "createdAt": 1234567890
    }
  ],
  "total": 100,
  "limit": 10,
  "offset": 0
}`}</code></pre>
        </div>

        <h4>GET /personas/:address</h4>

        <p>
          Get detailed information about a specific persona.
        </p>

        <div className="not-prose my-6 p-4 bg-muted rounded-lg">
          <pre className="text-sm overflow-x-auto"><code>{`GET /personas/0x...

Response:
{
  "address": "0x...",
  "name": "Example Persona",
  "symbol": "EXAMPLE",
  "description": "An example AI persona",
  "creator": "0x...",
  "totalSupply": "1000000",
  "liquidityPool": "0x...",
  "createdAt": 1234567890,
  "holders": 42,
  "transactions": 156
}`}</code></pre>
        </div>

        <h4>GET /personas/:address/price</h4>

        <p>
          Get current price and market data for a persona token.
        </p>

        <div className="not-prose my-6 p-4 bg-muted rounded-lg">
          <pre className="text-sm overflow-x-auto"><code>{`GET /personas/0x.../price

Response:
{
  "price": "0.0000123",
  "priceUsd": "0.045",
  "marketCap": "45000",
  "volume24h": "1234",
  "priceChange24h": "+5.67%",
  "liquidity": "12.5"
}`}</code></pre>
        </div>

        <h2>Rate Limits</h2>

        <p>
          API rate limits apply to protect service stability:
        </p>

        <ul>
          <li><strong>REST API:</strong> 100 requests per minute per IP</li>
          <li><strong>GraphQL:</strong> 1000 queries per hour per IP</li>
          <li><strong>WebSocket:</strong> 10 concurrent connections per IP</li>
        </ul>

        <div className="not-prose mt-8 p-4 bg-muted rounded-lg">
          <h3 className="text-lg font-semibold text-foreground mb-2">Need API Support?</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Join our developer community on Telegram for API help and updates.
          </p>
          <Button href="https://t.me/arbius_ai" external>
            Join Telegram
          </Button>
        </div>
      </DocsPageLayout>
    </Layout>
  )
}
