// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BridgeToBase
 * @notice Script to bridge AMICA tokens from Ethereum mainnet to Base L2
 * @dev Uses the official Base L1StandardBridge to deposit tokens
 *
 * Usage:
 * 1. Deploy AmicaTokenMainnet on Ethereum mainnet (with 1B tokens minted)
 * 2. Deploy AmicaTokenBridged on Base (with 0 tokens)
 * 3. Run this script to bridge tokens from mainnet to Base
 *
 * Bridge addresses:
 * - Mainnet L1StandardBridge: 0x3154Cf16ccdb4C6d922629664174b904d80F2C35
 * - Base (L2) receives tokens automatically via the bridge
 *
 * The bridge will:
 * 1. Lock AMICA tokens on L1 (mainnet)
 * 2. Mint equivalent AMICA tokens on L2 (Base)
 * 3. Maintain 1:1 parity between chains
 */
contract BridgeToBase is Script {
    // Base L1StandardBridge on Ethereum mainnet
    address constant L1_STANDARD_BRIDGE =
        0x3154Cf16ccdb4C6d922629664174b904d80F2C35;

    // Gas limit for L2 transaction (200k should be sufficient for token minting)
    uint32 constant L2_GAS_LIMIT = 200_000;

    struct BridgeResult {
        address l1Token;
        address l2Token;
        uint256 amount;
        address from;
        address to;
        uint256 chainId;
        uint256 blockNumber;
    }

    /**
     * @notice Bridge AMICA tokens from Ethereum mainnet to Base
     * @param l1TokenAddress Address of AMICA token on mainnet
     * @param l2TokenAddress Address of AMICA token on Base
     * @param amount Amount of tokens to bridge (in wei, 18 decimals)
     * @param recipient Address to receive tokens on Base (typically same as sender)
     */
    function bridgeTokens(
        address l1TokenAddress,
        address l2TokenAddress,
        uint256 amount,
        address recipient
    ) external returns (BridgeResult memory) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Validate chain
        require(block.chainid == 1, "Must run on Ethereum mainnet");

        console2.log("========================================");
        console2.log("Bridging AMICA to Base");
        console2.log("========================================");
        console2.log("L1 Token (Mainnet):", l1TokenAddress);
        console2.log("L2 Token (Base):", l2TokenAddress);
        console2.log("Amount:", amount / 1e18, "AMICA");
        console2.log("From:", deployer);
        console2.log("To:", recipient);
        console2.log("");

        IERC20 token = IERC20(l1TokenAddress);
        uint256 balance = token.balanceOf(deployer);
        console2.log("Current balance:", balance / 1e18, "AMICA");

        require(balance >= amount, "Insufficient balance");

        vm.startBroadcast(deployerPrivateKey);

        // Approve bridge to spend tokens
        console2.log("Approving L1StandardBridge...");
        token.approve(L1_STANDARD_BRIDGE, amount);

        // Bridge tokens using depositERC20To
        // This will lock tokens on L1 and mint on L2
        console2.log("Initiating bridge transaction...");
        IL1StandardBridge(L1_STANDARD_BRIDGE).depositERC20To(
            l1TokenAddress, // L1 token
            l2TokenAddress, // L2 token
            recipient, // to
            amount, // amount
            L2_GAS_LIMIT, // L2 gas limit
            "" // extra data
        );

        vm.stopBroadcast();

        BridgeResult memory result = BridgeResult({
            l1Token: l1TokenAddress,
            l2Token: l2TokenAddress,
            amount: amount,
            from: deployer,
            to: recipient,
            chainId: block.chainid,
            blockNumber: block.number
        });

        // Save bridge transaction
        _saveBridgeTransaction(result);

        console2.log("========================================");
        console2.log("Bridge Transaction Submitted!");
        console2.log("========================================");
        console2.log("Amount bridged:", amount / 1e18, "AMICA");
        console2.log(
            "Note: It will take ~10-15 minutes for tokens to appear on Base"
        );
        console2.log("Track your transaction on:");
        console2.log("  - Etherscan (L1)");
        console2.log("  - Basescan (L2) - check recipient address");
        console2.log("========================================");

        return result;
    }

    function _saveBridgeTransaction(BridgeResult memory result) internal {
        string memory obj = "bridge";

        vm.serializeUint(obj, "chainId", result.chainId);
        vm.serializeUint(obj, "blockNumber", result.blockNumber);
        vm.serializeAddress(obj, "l1Token", result.l1Token);
        vm.serializeAddress(obj, "l2Token", result.l2Token);
        vm.serializeUint(obj, "amount", result.amount);
        vm.serializeAddress(obj, "from", result.from);
        string memory finalJson = vm.serializeAddress(obj, "to", result.to);

        string memory filename = string.concat(
            "deployments/bridge-to-base-", vm.toString(block.timestamp), ".json"
        );

        vm.writeJson(finalJson, filename);
        console2.log("Bridge transaction saved to:", filename);
        console2.log("");
    }
}

/**
 * @notice Interface for Base L1StandardBridge
 * @dev Minimal interface for depositing ERC20 tokens to L2
 */
interface IL1StandardBridge {
    /**
     * @notice Deposit an amount of ERC20 to a recipient's balance on L2
     * @param _l1Token Address of the L1 ERC20 token
     * @param _l2Token Address of the L2 ERC20 token
     * @param _to L2 address to credit the withdrawal to
     * @param _amount Amount of the ERC20 to deposit
     * @param _l2Gas Gas limit for the L2 transaction
     * @param _data Optional data to forward to L2
     */
    function depositERC20To(
        address _l1Token,
        address _l2Token,
        address _to,
        uint256 _amount,
        uint32 _l2Gas,
        bytes calldata _data
    ) external;
}
