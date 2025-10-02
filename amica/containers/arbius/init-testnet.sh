#!/bin/bash

# Initialize and run Arbius local testnet

set -e

echo "========================================="
echo "Arbius Local Testnet Initialization"
echo "========================================="

cd /app/contract

# Create empty config if it doesn't exist
if [ ! -f scripts/config.local.json ]; then
    echo '{}' > scripts/config.local.json
fi

# Start Hardhat node in the background
echo "Starting Hardhat node..."
npx hardhat node --hostname 0.0.0.0 &
HARDHAT_PID=$!

# Wait for Hardhat to be ready
echo "Waiting for Hardhat node to be ready..."
for i in {1..30}; do
    if curl -s -X POST --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://localhost:8545 > /dev/null 2>&1; then
        echo "Hardhat node is ready!"
        break
    fi
    sleep 1
done

# Deploy contracts
echo "Deploying Arbius contracts to local network..."
echo "Creating V6 deployment script..."
cat > scripts/deploy-local-net-v6.ts << 'EOF'
import { ethers, upgrades } from "hardhat";
import * as fs from 'fs';
import 'dotenv/config';

async function main() {
  const signers = await ethers.getSigners();
  const deployer = signers[0];

  console.log("Deploying contracts with the account:", deployer.address);

  const solutionStakeAmount = ethers.utils.parseEther('0.001');
  const startTime = Math.floor(Date.now() / 1000);

  console.log('Deploying the L2Token:');
  const L2Token = await ethers.getContractFactory('BaseTokenV1');
  const l2Token = await upgrades.deployProxy(L2Token, [
    deployer.address,
    deployer.address,
  ]);
  await l2Token.deployed();
  console.log(`L2Token deployed to: ${l2Token.address}`);

  const EngineV1 = await ethers.getContractFactory("EngineV1");
  const EngineV2 = await ethers.getContractFactory("V2_EngineV2");
  const EngineV3 = await ethers.getContractFactory("V2_EngineV3");
  const EngineV4 = await ethers.getContractFactory("V2_EngineV4");
  const EngineV5 = await ethers.getContractFactory("V2_EngineV5");
  const EngineV6 = await ethers.getContractFactory("V2_EngineV6");

  let engine = await upgrades.deployProxy(EngineV1, [
    l2Token.address,
    deployer.address,
  ]);
  await engine.deployed();
  console.log("Engine deployed to:", engine.address);

  engine = await upgrades.upgradeProxy(engine.address, EngineV2);
  console.log("Engine upgraded to V2");

  await (await engine.setSolutionStakeAmount(solutionStakeAmount)).wait();
  console.log(`Solution stake amount set to ${solutionStakeAmount}`);

  await (await engine.setStartBlockTime(startTime)).wait();
  console.log(`Start block time set to ${new Date(startTime * 1000).toString()}`);

  engine = await upgrades.upgradeProxy(engine.address, EngineV3, { call: "initialize" });
  console.log("Engine upgraded to V3");

  engine = await upgrades.upgradeProxy(engine.address, EngineV4, { call: "initialize" });
  console.log("Engine upgraded to V4");

  engine = await upgrades.upgradeProxy(engine.address, EngineV5, { call: "initialize" });
  console.log("Engine upgraded to V5");

  engine = await upgrades.upgradeProxy(engine.address, EngineV6, { call: "initialize" });
  console.log("Engine upgraded to V6");

  const VeNFTRender = await ethers.getContractFactory("VeNFTRender");
  const VotingEscrow = await ethers.getContractFactory("VotingEscrow");
  const VeStaking = await ethers.getContractFactory("VeStaking");

  const veNFTRender = await VeNFTRender.deploy();
  console.log("VeNFTRender deployed to:", veNFTRender.address);

  const votingEscrow = await VotingEscrow.deploy(
    l2Token.address,
    veNFTRender.address,
    ethers.constants.AddressZero
  );
  console.log("VotingEscrow deployed to:", votingEscrow.address);

  const veStaking = await VeStaking.deploy(
    l2Token.address,
    votingEscrow.address
  );
  console.log("VeStaking deployed to:", veStaking.address);

  await (await votingEscrow.setVeStaking(veStaking.address)).wait();
  console.log("VeStaking set in VotingEscrow");

  await (await engine.setVeStaking(veStaking.address)).wait();
  console.log("VeStaking set in Engine");

  for (const signer of signers) {
    await (await l2Token.bridgeMint(signer.address, ethers.utils.parseEther('1000'))).wait();
    console.log(`Minted 1000 tokens to ${signer.address}`);
  }

  console.log('Deploying free mineable model: kandinsky2');
  const template = '0x' + fs.readFileSync(`${__dirname}/../../templates/kandinsky2.json`, 'hex');
  const addr = '0x0000000000000000000000000000000000000001';
  const fee = ethers.utils.parseEther('0');
  const rate = ethers.utils.parseEther('1');
  const cid = await engine.generateIPFSCID(template);
  const modelId = await engine.hashModel({ addr, fee, rate, cid }, deployer.address);

  await (await engine.registerModel(addr, fee, template)).wait();
  console.log('Model registered with id:', modelId);

  await (await engine.setSolutionMineableRate(modelId, rate)).wait();
  console.log('Model is now mineable');

  const configPath = __dirname + '/config.local.json';
  fs.writeFileSync(configPath, JSON.stringify({
    v6_baseTokenAddress: l2Token.address,
    v6_engineAddress: engine.address,
    votingEscrowAddress: votingEscrow.address,
    veStakingAddress: veStaking.address,
    models: {
      kandinsky2: {
        id: modelId,
        mineable: true,
        params: { addr, fee: fee.toString(), rate: rate.toString(), cid },
      },
    },
  }, null, 2));
  console.log('Saved config to', configPath);
  process.exit(0);
}

main();
EOF

npx hardhat --network localhost run scripts/deploy-local-net-v6.ts

echo ""
echo "========================================="
echo "Arbius Local Testnet is Ready!"
echo "========================================="
echo ""
echo "RPC Endpoint: http://localhost:8545"
echo "Chain ID: 31337"
echo ""
echo "Default Hardhat Accounts:"
echo "Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo "Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
echo ""
echo "Contract addresses written to console above."
echo "Use these addresses to configure Amica."
echo ""
echo "========================================="
echo ""

# Keep the container running
wait $HARDHAT_PID
