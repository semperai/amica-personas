// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

import {AmicaFeeReductionHook} from "../contracts/AmicaFeeReductionHook.sol";

// IMPORTANT
// Replace with actual addresses
address constant CREATE2_DEPLOYER = address(0x0);
address constant POOLMANAGER = address(0x0);

/// @notice Mines the address and deploys the AmicaFeeReductionHook.sol Hook contract
contract DeployAmicaHookMinedAddressScript is Script {
    function setUp() public {}

    function run() public {
        // hook contracts must have specific flags encoded in the address
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG);

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(POOLMANAGER);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(AmicaFeeReductionHook).creationCode, constructorArgs);

        // Deploy the hook using CREATE2
        vm.broadcast();
        AmicaFeeReductionHook hook = new AmicaFeeReductionHook{salt: salt}(IPoolManager(POOLMANAGER));
        require(address(hook) == hookAddress, "DeployAmicaHookMinedAddressScript: hook address mismatch");
    }
}
