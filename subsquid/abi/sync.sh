#!/usr/bin/env bash
cat ../../contracts/out/AmicaTokenMainnet.sol/AmicaTokenMainnet.json | jq ".abi" > AmicaTokenMainnet.json
cat ../../contracts/out/AmicaTokenBridged.sol/AmicaTokenBridged.json | jq ".abi" > AmicaTokenBridged.json
cat ../../contracts/out/PersonaTokenFactory.sol/PersonaTokenFactory.json | jq ".abi" > PersonaTokenFactory.json
cat ../../contracts/out/PersonaFactoryViewer.sol/PersonaFactoryViewer.json | jq ".abi" > PersonaFactoryViewer.json

# Remove old files that no longer exist
rm -f AmicaToken.json
rm -f BridgeWrapper.json
rm -f PersonaStakingRewards.json
rm -f AmicaBridgeWrapper.json
rm -f ../src/abi/AmicaToken.ts
rm -f ../src/abi/BridgeWrapper.ts
rm -f ../src/abi/PersonaStakingRewards.ts
rm -f ../src/abi/AmicaBridgeWrapper.ts

sqd typegen
