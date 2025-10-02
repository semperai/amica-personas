# Arbius Local Testnet Container

Run a local Arbius blockchain testnet for development and testing with Amica.

## What is This?

This container runs a local Hardhat network with Arbius smart contracts deployed. It's useful for:
- Testing Amica's Arbius integration without mainnet costs
- Development without requiring real ETH or AIUS tokens
- Local AI task submission and validation testing
- Understanding how Arbius works

## Quick Start

```bash
# Build and start the local testnet
docker-compose up -d

# View initialization logs
docker-compose logs -f
```

⚠️ **Note**: First startup may take 2-3 minutes to:
1. Clone Arbius repository
2. Install dependencies
3. Start Hardhat node
4. Deploy all contracts

## What Gets Deployed

The local testnet includes:
- **BaseToken (AIUS)** - The Arbius token
- **Engine (V1→V6)** - Main protocol contract (latest is V6)
- **VotingEscrow** - Governance and staking
- **VeStaking** - Validator staking mechanism
- **All models** - AI model contracts

## Configuration

Edit `.env` file to customize:

```bash
# Port
ARBIUS_PORT=8545

# Chain ID (don't change unless you know what you're doing)
ARBIUS_CHAIN_ID=31337
```

## Configure Amica with Local Arbius

1. Open Amica settings
2. Navigate to "Chatbot Backend"
3. Select "Arbius"
4. Configure:
   - **RPC URL**: `http://localhost:8545`
   - **Chain ID**: `31337`
   - **Model ID**: (shown in initialization logs)
   - **Private Key**: Use one of the test accounts below

## Test Accounts

The local network comes with pre-funded test accounts:

### Account #0 (Default Deployer)
```
Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### Account #1
```
Address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

### Account #2
```
Address: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
```

Each account starts with **10,000 ETH** for testing.

## Using the Testnet

### Submit a Task

```bash
# From inside the container
docker exec -it amica-arbius-testnet bash

# Submit a test task
npx hardhat --network localhost mining:submitTask \
  --model 0x002a11afdb4f9e0ae985136622cbea64dd5d90d3d751ce1ad2391264e886aad1 \
  --fee 0.001 \
  --input "Generate an image of a sunset"
```

### Become a Validator

```bash
docker exec -it amica-arbius-testnet bash

# Get mining allowance
npx hardhat --network localhost mining:allowance

# Stake as validator
npx hardhat --network localhost validator:stake
```

### Check Task Status

```bash
docker exec -it amica-arbius-testnet bash

npx hardhat --network localhost task:info --task <task-id>
```

## RPC Endpoint

The testnet exposes a standard Ethereum JSON-RPC endpoint:

```
http://localhost:8545
```

### Example RPC Calls

```bash
# Get latest block
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Get account balance
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","latest"],"id":1}'
```

## Integration with Amica

### Configure Wallet

Amica needs a wallet to interact with Arbius. Use one of the test accounts:

1. Settings → Arbius Settings
2. Enter RPC URL: `http://localhost:8545`
3. Enter Private Key: (from test accounts above)
4. Model ID: Check initialization logs or use default

### Test AI Task Flow

1. **Submit Task**: Amica sends a task to Arbius
2. **Wait for Solution**: Validators process the task
3. **Retrieve Result**: Amica fetches the completed task

## Contract Addresses

After deployment, contract addresses are logged. You can find them in:

```bash
docker-compose logs | grep "deployed to"
```

Common contracts:
- **L2Token (AIUS)**: ERC20 token contract
- **Engine**: Main protocol contract
- **VotingEscrow**: Governance contract

## Troubleshooting

### Container fails to start

```bash
# Check logs
docker-compose logs

# Rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Hardhat node not responding

```bash
# Restart the container
docker-compose restart
```

### Need to reset blockchain state

```bash
# Stop and remove volumes
docker-compose down -v

# Restart (will redeploy everything)
docker-compose up -d
```

### Can't connect from Amica

- Ensure Amica can reach `localhost:8545`
- If running Amica in Docker, use container name instead: `arbius-testnet:8545`
- Check firewall settings

## Development

### Access Container Shell

```bash
docker exec -it amica-arbius-testnet bash
```

### Run Hardhat Commands

```bash
docker exec -it amica-arbius-testnet npx hardhat --network localhost <command>
```

### View Hardhat Console

```bash
docker exec -it amica-arbius-testnet npx hardhat console --network localhost
```

## Differences from Mainnet

⚠️ **Important Differences**:

1. **Chain ID**: 31337 (testnet) vs 42161 (Arbitrum One)
2. **No Real Value**: Tokens have no real value
3. **Fast Blocks**: Instant mining (no waiting)
4. **Pre-funded**: Accounts start with 10,000 ETH
5. **Resets**: State is lost when container stops (unless using volumes)
6. **No Validators**: You need to manually stake/validate

## Persistence

By default, blockchain state persists in Docker volumes:
- `arbius-data` - Contract artifacts
- `arbius-cache` - Hardhat cache

To completely reset:
```bash
docker-compose down -v
```

## Resources

- RAM: ~1-2GB
- CPU: Low (Hardhat is lightweight)
- Storage: ~500MB for dependencies
- Network: None required (runs locally)

## Advanced Usage

### Custom Contract Deployment

```bash
docker exec -it amica-arbius-testnet bash
cd /app/contract

# Deploy custom contracts
npx hardhat run scripts/your-script.ts --network localhost
```

### Forking Mainnet

To test against real Arbius state, you can fork mainnet:

```yaml
# Add to docker-compose.yml environment:
- FORK=true
- FORK_URL=https://arb1.arbitrum.io/rpc
```

## Security Notes

⚠️ **For Development Only**:
- Never use test account private keys on mainnet
- This setup is not suitable for production
- No security audits have been performed
- Use only for testing and development

## Resources

- [Arbius Documentation](https://docs.arbius.ai/)
- [Arbius GitHub](https://github.com/semperai/arbius)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Arbitrum Documentation](https://docs.arbitrum.io/)
