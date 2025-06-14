# Amica Multichain Indexer

A high-performance multichain indexer for the Amica protocol, built with [Subsquid](https://subsquid.io). Tracks personas, trading activity, and bridge operations across Ethereum, Base, Arbitrum, and other EVM chains.

## Features

- 🌐 **Multichain Support**: Index personas across multiple EVM chains simultaneously
- 🔄 **Real-time Updates**: Live tracking of trades, metadata updates, and graduations
- 🌉 **Bridge Monitoring**: Track AMICA token movements between chains
- 📊 **Advanced Analytics**: Volume tracking, leaderboards, and trending personas
- 🚀 **High Performance**: Efficient batch processing with minimal RPC calls
- 📈 **GraphQL API**: Rich querying capabilities with filtering and sorting
- 🔌 **REST API**: Simple HTTP endpoints for frontend integration

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Ethereum      │     │     Base        │     │   Arbitrum      │
│   Processor     │     │   Processor     │     │   Processor     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                         │
         └───────────────────────┴─────────────────────────┘
                                 │
                         ┌───────▼────────┐
                         │   PostgreSQL   │
                         │    Database    │
                         └───────┬────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
         ┌───────▼────────┐             ┌───────▼────────┐
         │  GraphQL API   │             │   REST API     │
         │  (Port 4350)   │             │  (Port 3001)   │
         └────────────────┘             └────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- RPC endpoints for target chains
- Deployed Amica contracts

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/amica-indexer
cd amica-indexer

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Configuration

1. **Edit `.env`** with your values:

```env
# Ethereum Mainnet
ETHEREUM_RPC=https://mainnet.infura.io/v3/YOUR_KEY
ETHEREUM_AMICA_TOKEN=0x...
ETHEREUM_FACTORY=0x...
ETHEREUM_DEPLOYMENT_BLOCK=18500000

# Base
BASE_RPC=https://mainnet.base.org
BASE_AMICA_TOKEN=0x...
BASE_FACTORY=0x...
BASE_BRIDGE_WRAPPER=0x...
BASE_DEPLOYMENT_BLOCK=8000000

# Arbitrum
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
ARBITRUM_AMICA_TOKEN=0x...
ARBITRUM_FACTORY=0x...
ARBITRUM_BRIDGE_WRAPPER=0x...
ARBITRUM_DEPLOYMENT_BLOCK=150000000

# Enabled chains (comma-separated chain IDs)
ENABLED_CHAINS=1,8453,42161
```

2. **Update chain configuration** in `src/config/chains.ts`

### Running Locally

```bash
# Start PostgreSQL
docker-compose up -d db

# Generate TypeORM models
npx squid-typeorm-codegen

# Generate ABI types
npm run codegen

# Run database migrations
npm run db:migrate

# Start the indexer
npm run dev

# In another terminal, start GraphQL server
npm run query-node:start

# In another terminal, start REST API
npm run api:start
```

### Using Docker

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop services
docker-compose down
```

## API Usage

### GraphQL API (http://localhost:4350/graphql)

#### Get top personas across all chains
```graphql
query TopPersonasGlobal {
  personas(
    orderBy: totalVolume24h_DESC
    limit: 10
  ) {
    id
    name
    symbol
    totalVolume24h
    creator
    chain {
      name
    }
  }
}
```

#### Get personas on specific chain
```graphql
query PersonasOnBase {
  personas(
    where: { chain: { id_eq: "8453" } }
    orderBy: totalVolume24h_DESC
  ) {
    id
    name
    totalVolume24h
    isGraduated
  }
}
```

#### Search personas
```graphql
query SearchPersonas($search: String!) {
  personas(
    where: { name_containsInsensitive: $search }
    limit: 20
  ) {
    id
    name
    symbol
    chain {
      name
    }
  }
}
```

### REST API (http://localhost:3001)

#### Get all supported chains
```bash
GET /api/chains
```

#### Get personas with filters
```bash
GET /api/personas?chainId=8453&sort=totalVolume24h_DESC&limit=20
```

#### Get persona details
```bash
GET /api/personas/{chainId}/{tokenId}
```

#### Get global statistics
```bash
GET /api/stats
```

#### Get user portfolio
```bash
GET /api/users/{address}/portfolio
```

#### Search personas
```bash
GET /api/search?q=persona&chainId=8453
```

## Schema

### Core Entities

- **Chain**: Blockchain network information
- **Persona**: NFT with associated ERC20 token
- **Trade**: Token purchase on bonding curve
- **Metadata**: Key-value pairs for personas
- **BridgeActivity**: Cross-chain token movements
- **DailyVolume**: Aggregated daily trading volume

See [schema.graphql](./schema.graphql) for complete definitions.

## Adding New Chains

1. **Update environment variables** in `.env`:
```env
POLYGON_RPC=https://polygon-rpc.com
POLYGON_AMICA_TOKEN=0x...
POLYGON_FACTORY=0x...
POLYGON_BRIDGE_WRAPPER=0x...
POLYGON_DEPLOYMENT_BLOCK=45000000
```

2. **Add chain configuration** in `src/config/chains.ts`:
```typescript
137: {
  id: 137,
  name: 'polygon',
  rpcUrl: process.env.POLYGON_RPC!,
  archive: 'https://v2.archive.subsquid.io/network/polygon-mainnet',
  amicaToken: process.env.POLYGON_AMICA_TOKEN!,
  factoryAddress: process.env.POLYGON_FACTORY!,
  bridgeWrapperAddress: process.env.POLYGON_BRIDGE_WRAPPER!,
  deploymentBlock: parseInt(process.env.POLYGON_DEPLOYMENT_BLOCK!),
  isMainnet: false
}
```

3. **Update enabled chains**:
```env
ENABLED_CHAINS=1,8453,42161,137
```

4. **Restart the indexer**

## Production Deployment

### Using Subsquid Cloud

```bash
# Install Subsquid CLI
npm i -g @subsquid/cli

# Login
sqd login

# Deploy
sqd deploy --org YOUR_ORG ./
```

### Using Kubernetes

See [k8s/](./k8s/) directory for Kubernetes manifests.

### Performance Tuning

- **Batch Size**: Adjust in processor configuration (default: 100)
- **RPC Rate Limit**: Configure per chain in `chains.ts`
- **Database Pool**: Set max connections in `ormconfig.json`
- **Memory**: Increase Node.js heap size if needed

## Monitoring

### Health Checks

- Indexer health: `http://localhost:4350/health`
- API health: `http://localhost:3001/health`
- Metrics: `http://localhost:4350/metrics`

### Recommended Metrics

- Indexer lag (blocks behind head)
- RPC request rate and errors
- Database query performance
- API response times

## Troubleshooting

### Common Issues

**RPC rate limits exceeded**
- Reduce `rateLimit` in chain configuration
- Use archive nodes for historical data

**Out of memory errors**
```bash
NODE_OPTIONS="--max-old-space-size=8192" npm run processor:start
```

**Slow queries**
- Add database indexes for common queries
- Enable query logging to identify bottlenecks

**Missing events**
- Verify contract addresses are correct
- Check deployment block numbers
- Ensure ABIs match deployed contracts

## Development

### Project Structure

```
src/
├── abi/                  # Contract ABIs and generated types
├── config/               # Chain configurations
├── model/               # TypeORM entities
├── processors/          # Chain-specific processors
├── utils/               # Helper functions
├── main.ts              # Main processor entry
└── api-service.ts       # REST API server
```

### Running Tests

```bash
npm test
```

### Code Style

```bash
npm run lint
npm run format
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Documentation: [https://docs.subsquid.io](https://docs.subsquid.io)
- Discord: [Join our community](https://discord.gg/subsquid)
- Issues: [GitHub Issues](https://github.com/your-org/amica-indexer/issues)

## Acknowledgments

- Built with [Subsquid](https://subsquid.io)
- Powered by [TypeORM](https://typeorm.io)
- GraphQL server by [Apollo](https://www.apollographql.com)
