// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

import {DynamicFeeHook} from "../contracts/DynamicFeeHook.sol";

// IMPORTANT
// Replace with actual addresses
address constant CREATE2_DEPLOYER = address(0x4e59b44847b379578588920cA78FbF26c0B4956C);
address constant POOLMANAGER = address(0x498581fF718922c3f8e6A244956aF099B2652b2b);

/// @notice Mines the address and deploys the DynamicFeeHook.sol Hook contract
contract DeployDynamicFeeHookScript is Script {
    function setUp() public {}

    function run() public {
        // hook contracts must have specific flags encoded in the address
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG);

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(POOLMANAGER);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(DynamicFeeHook).creationCode, constructorArgs);

        // Deploy the hook using CREATE2
        vm.broadcast(vm.envUint("PRIVATE_KEY_HEX"));
        DynamicFeeHook hook = new DynamicFeeHook{salt: salt}(IPoolManager(POOLMANAGER));
        require(address(hook) == hookAddress, "DeployDynamicFeeHook: hook address mismatch");
    }
}
