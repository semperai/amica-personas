#!/usr/bin/env bash
cat ../../contract/artifacts/contracts/AmicaBridgeWrapper.sol/AmicaBridgeWrapper.json| jq ".abi" > AmicaBridgeWrapper.json
cat ../../contract/artifacts/contracts/AmicaToken.sol/AmicaToken.json | jq ".abi" > AmicaToken.json
cat ../../contract/artifacts/contracts/PersonaTokenFactory.sol/PersonaTokenFactory.json | jq ".abi" > PersonaTokenFactory.json
cat ../../contract/artifacts/contracts/PersonaFactoryViewer.sol/PersonaFactoryViewer.json | jq ".abi" > PersonaFactoryViewer.json
cat ../../contract/artifacts/contracts/PersonaStakingRewards.sol/PersonaStakingRewards.json| jq ".abi" > PersonaStakingRewards.json

sqd typegen
