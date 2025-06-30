# Amica Protocol Deployment

Foundry-based deployment system for the Amica Protocol with Uniswap V4 integration.

## Installation

```bash
git clone <your-repo-url>
cd amica-protocol
forge install
mkdir deployments
```

## Configuration

Create `.env`:

```env
PRIVATE_KEY=your_private_key_here
BASE_RPC_URL=https://mainnet.base.org
BASESCAN_API_KEY=your_basescan_key
```

## Local Development

### Start Local Node
```bash
# Fork Base mainnet
anvil --fork-url $BASE_RPC_URL
```

### Deploy Locally
```bash
# Deploy to local fork
forge script script/DeployAmicaProtocol.s.sol:DeployAmicaProtocol \
  --rpc-url http://localhost:8545 \
  --broadcast

# Configure pairing tokens
forge script script/DeployUtils.s.sol:DeployUtils \
  --sig "configurePairingTokens()" \
  --rpc-url http://localhost:8545 \
  --broadcast
```

## Base Mainnet Deployment

### Deploy
```bash
forge script script/DeployAmicaProtocol.s.sol:DeployAmicaProtocol \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify
```

### Post-Deployment Setup
```bash
# Configure pairing tokens (USDC, WETH)
forge script script/DeployUtils.s.sol:DeployUtils \
  --sig "configurePairingTokens()" \
  --rpc-url $BASE_RPC_URL \
  --broadcast

# Set fee reduction parameters
forge script script/DeployUtils.s.sol:DeployUtils \
  --sig "updateFeeReduction()" \
  --rpc-url $BASE_RPC_URL \
  --broadcast

# Check deployment
forge script script/DeployUtils.s.sol:DeployUtils \
  --sig "checkDeployment()" \
  --rpc-url $BASE_RPC_URL
```

## Upgrading Contracts

```bash
# Upgrade AmicaToken (ContractType = 0)
forge script script/UpgradeAmicaProtocol.s.sol:UpgradeAmicaProtocol \
  --sig "upgradeContract(uint8)" 0 \
  --rpc-url $BASE_RPC_URL \
  --broadcast

# Upgrade PersonaFactory (ContractType = 1)
forge script script/UpgradeAmicaProtocol.s.sol:UpgradeAmicaProtocol \
  --sig "upgradeContract(uint8)" 1 \
  --rpc-url $BASE_RPC_URL \
  --broadcast
```

## Foundry Commands

### Build
```bash
forge build
```

### Test
```bash
forge test
```

### Format
```bash
forge fmt
```

### Gas Snapshots
```bash
forge snapshot
```
