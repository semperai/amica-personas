# Deployment Scripts

This directory contains scripts for deploying and upgrading the Amica token contracts.

## Prerequisites

1. Set up your environment variables:
```bash
export PRIVATE_KEY=0x... # Your deployer private key
export RPC_URL=https://... # RPC endpoint for target network
```

## Initial Deployment

### Deploy AmicaTokenMainnet (Ethereum)

```bash
forge script script/DeployAmicaMainnet.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

This will:
- Deploy the AmicaTokenMainnet implementation
- Deploy a UUPS proxy
- Initialize with 1 billion AMICA tokens
- Save deployment info to `deployments/amica-mainnet-{chainId}.json`

### Deploy AmicaTokenBridged (Arbitrum/Base)

```bash
forge script script/DeployAmicaBridged.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

This will:
- Deploy the AmicaTokenBridged implementation
- Deploy a UUPS proxy
- Initialize with 0 initial supply (bridged version)
- Save deployment info to `deployments/amica-bridged-{chainId}.json`

## Upgrading to V2

### Upgrade Mainnet Contract

```bash
export AMICA_MAINNET_PROXY=0x... # Address from deployment JSON

forge script script/UpgradeAmicaMainnet.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

This will:
- Deploy AmicaTokenMainnetV2 implementation
- Upgrade the proxy to point to V2
- Verify upgrade succeeded (calls `version()` and `upgradeTest()`)
- Save upgrade info to `deployments/amica-mainnet-upgrade-{chainId}-{timestamp}.json`

### Upgrade Bridged Contract

```bash
export AMICA_BRIDGED_PROXY=0x... # Address from deployment JSON

forge script script/UpgradeAmicaBridged.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

This will:
- Deploy AmicaTokenBridgedV2 implementation
- Upgrade the proxy to point to V2
- Verify upgrade succeeded
- Save upgrade info to `deployments/amica-bridged-upgrade-{chainId}-{timestamp}.json`

## Testing Locally

You can test the deployment scripts locally using Anvil:

```bash
# Start local node
anvil

# In another terminal, run deployment
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export RPC_URL=http://localhost:8545

forge script script/DeployAmicaMainnet.s.sol \
  --rpc-url $RPC_URL \
  --broadcast
```

## Deployment Outputs

### Initial Deployment JSON
```json
{
  "chainId": 1,
  "blockNumber": 12345678,
  "proxy": "0x...",
  "implementation": "0x...",
  "proxyAdmin": "0x..."
}
```

### Upgrade JSON
```json
{
  "chainId": 1,
  "blockNumber": 12345679,
  "proxy": "0x...",
  "oldImplementation": "0x...",
  "newImplementation": "0x...",
  "version": "2.0.0"
}
```

## Network-Specific Deployments

### Ethereum Mainnet
```bash
export RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
# Deploy mainnet version
```

### Arbitrum One (Chain ID: 42161)
```bash
export RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
# Deploy bridged version
```

### Base (Chain ID: 8453)
```bash
export RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
# Deploy bridged version
```

### Testnets

#### Sepolia
```bash
export RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
```

#### Arbitrum Sepolia (Chain ID: 421614)
```bash
export RPC_URL=https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY
```

#### Base Sepolia (Chain ID: 84532)
```bash
export RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
```

## Post-Deployment Configuration

After deploying the bridged version, you may want to configure deposit tokens:

```bash
forge script script/DeployAmicaBridged.s.sol \
  --sig "configureDepositToken(address,address,bool,uint256,uint8)" \
  $AMICA_PROXY \
  $TOKEN_ADDRESS \
  true \
  1000000000000000000 \
  6 \
  --rpc-url $RPC_URL \
  --broadcast
```

Parameters:
- `amicaProxy`: Address of the AMICA proxy contract
- `token`: Address of the deposit token (e.g., USDC)
- `enabled`: true to enable, false to disable
- `exchangeRate`: How much AMICA per 1 token (18 decimals)
- `decimals`: Decimals of the deposit token

Example for USDC (1:1 exchange rate):
```bash
forge script script/DeployAmicaBridged.s.sol \
  --sig "configureDepositToken(address,address,bool,uint256,uint8)" \
  0xYourAmicaProxy \
  0xUSDCAddress \
  true \
  1000000000000000000 \
  6 \
  --rpc-url $RPC_URL \
  --broadcast
```

## Security Checklist

Before deploying to mainnet:

- [ ] Verify deployer address has sufficient ETH for gas
- [ ] Double-check owner address is correct
- [ ] Test deployment on testnet first
- [ ] Verify all contracts on block explorer
- [ ] Save all deployment addresses and JSONs
- [ ] Test basic functionality (transfers, configurations)
- [ ] For upgrades: verify all state is preserved
- [ ] For upgrades: test with small operations first

## Troubleshooting

### "insufficient funds for gas"
Ensure deployer address has enough ETH for deployment gas costs.

### "Failed to get EIP-1559 fees"
Use `--legacy` flag for networks that don't support EIP-1559.

### "Contract already deployed"
Check if the contract is already deployed at the expected address.

### Upgrade fails with "Unauthorized"
Ensure AMICA_MAINNET_PROXY or AMICA_BRIDGED_PROXY is set to the correct proxy address, and the deployer is the owner.

## Additional Scripts

### BridgeToArbitrum.s.sol
Script for bridging AMICA from Ethereum to Arbitrum One.

### BridgeToBase.s.sol
Script for bridging AMICA from Ethereum to Base.

### DeployAmicaProtocol.s.sol
Comprehensive deployment script for the entire Amica protocol including:
- AmicaToken
- PersonaTokenFactory
- DynamicFeeHook
- BondingCurve
- All supporting contracts

### VerifyAmicaProtocol.s.sol
Verification script for deployed contracts on block explorers.

## Support

For issues or questions:
- Open an issue at: https://github.com/amica-personas/contracts/issues
- Email: kasumi-null@yandex.com
