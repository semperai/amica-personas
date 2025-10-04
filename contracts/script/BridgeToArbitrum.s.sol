// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BridgeToArbitrum
 * @notice Script to bridge AMICA tokens from Ethereum mainnet to Arbitrum One
 * @dev Uses the official Arbitrum L1GatewayRouter to deposit tokens
 *
 * Usage:
 * 1. Deploy AmicaTokenMainnet on Ethereum mainnet (with 1B tokens minted)
 * 2. Deploy AmicaTokenBridged on Arbitrum One (with 0 tokens)
 * 3. Run this script to bridge tokens from mainnet to Arbitrum
 *
 * Bridge addresses:
 * - Mainnet L1GatewayRouter: 0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef
 * - Arbitrum (L2) receives tokens automatically via the gateway
 *
 * The bridge will:
 * 1. Lock AMICA tokens on L1 (mainnet)
 * 2. Mint equivalent AMICA tokens on L2 (Arbitrum One)
 * 3. Maintain 1:1 parity between chains
 */
contract BridgeToArbitrum is Script {
    // Arbitrum L1GatewayRouter on Ethereum mainnet
    address constant L1_GATEWAY_ROUTER =
        0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef;

    // Gas limit for L2 transaction (200k should be sufficient for token minting)
    uint256 constant MAX_GAS = 200_000;

    // Gas price bid for L2 (1 gwei, will be adjusted by the bridge)
    uint256 constant GAS_PRICE_BID = 1 gwei;

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
     * @notice Bridge AMICA tokens from Ethereum mainnet to Arbitrum One
     * @param l1TokenAddress Address of AMICA token on mainnet
     * @param l2TokenAddress Address of AMICA token on Arbitrum One
     * @param amount Amount of tokens to bridge (in wei, 18 decimals)
     * @param recipient Address to receive tokens on Arbitrum (typically same as sender)
     */
    function bridgeTokens(
        address l1TokenAddress,
        address l2TokenAddress,
        uint256 amount,
        address recipient
    ) external payable returns (BridgeResult memory) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Validate chain
        require(block.chainid == 1, "Must run on Ethereum mainnet");

        console2.log("========================================");
        console2.log("Bridging AMICA to Arbitrum One");
        console2.log("========================================");
        console2.log("L1 Token (Mainnet):", l1TokenAddress);
        console2.log("L2 Token (Arbitrum):", l2TokenAddress);
        console2.log("Amount:", amount / 1e18, "AMICA");
        console2.log("From:", deployer);
        console2.log("To:", recipient);
        console2.log("");

        IERC20 token = IERC20(l1TokenAddress);
        uint256 balance = token.balanceOf(deployer);
        console2.log("Current balance:", balance / 1e18, "AMICA");

        require(balance >= amount, "Insufficient balance");

        // Calculate submission cost (bridge fee)
        uint256 maxSubmissionCost =
            IL1GatewayRouter(L1_GATEWAY_ROUTER).calculateRetryableSubmissionFee(
                0, // data length (empty for standard ERC20 bridge)
                block.basefee // current base fee
            );

        // Total ETH needed = maxSubmissionCost + (MAX_GAS * GAS_PRICE_BID)
        uint256 totalEthNeeded = maxSubmissionCost + (MAX_GAS * GAS_PRICE_BID);

        console2.log("Bridge fee required:", totalEthNeeded / 1e18, "ETH");
        console2.log("ETH balance:", deployer.balance / 1e18, "ETH");
        require(deployer.balance >= totalEthNeeded, "Insufficient ETH for fees");

        vm.startBroadcast(deployerPrivateKey);

        // Approve gateway to spend tokens
        console2.log("Approving L1GatewayRouter...");
        token.approve(L1_GATEWAY_ROUTER, amount);

        // Bridge tokens using outboundTransferCustomRefund
        // This will lock tokens on L1 and mint on L2
        console2.log("Initiating bridge transaction...");
        console2.log("Sending", totalEthNeeded / 1e18, "ETH for fees...");

        // Build data payload
        bytes memory outboundData = _buildOutboundData(maxSubmissionCost, l2TokenAddress);

        IL1GatewayRouter(L1_GATEWAY_ROUTER).outboundTransferCustomRefund{
            value: totalEthNeeded
        }(
            l1TokenAddress, // L1 token
            recipient, // refund address (excess fees refunded here)
            recipient, // to
            amount, // amount
            MAX_GAS, // max gas
            GAS_PRICE_BID, // gas price bid
            outboundData // data
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
            "Note: It will take ~10-15 minutes for tokens to appear on Arbitrum"
        );
        console2.log("Track your transaction on:");
        console2.log("  - Etherscan (L1)");
        console2.log("  - Arbiscan (L2) - check recipient address");
        console2.log("========================================");

        return result;
    }

    /**
     * @notice Build the data payload for outboundTransferCustomRefund
     * @param maxSubmissionCost Maximum submission cost for the L2 transaction
     * @param l2Token Address of the token on L2
     */
    function _buildOutboundData(
        uint256 maxSubmissionCost,
        address l2Token
    ) internal pure returns (bytes memory) {
        // Encode: maxSubmissionCost, extraData (which contains L2 token address)
        bytes memory extraData = abi.encode(l2Token);
        return abi.encode(maxSubmissionCost, extraData);
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
            "deployments/bridge-to-arbitrum-",
            vm.toString(block.timestamp),
            ".json"
        );

        vm.writeJson(finalJson, filename);
        console2.log("Bridge transaction saved to:", filename);
        console2.log("");
    }
}

/**
 * @notice Interface for Arbitrum L1GatewayRouter
 * @dev Minimal interface for depositing ERC20 tokens to L2
 */
interface IL1GatewayRouter {
    /**
     * @notice Transfer ERC20 to L2 with custom refund address
     * @param _l1Token L1 address of ERC20
     * @param _refundTo Account to receive excess gas refund on L2
     * @param _to Account to be credited with tokens on L2
     * @param _amount Amount of tokens to transfer
     * @param _maxGas Max gas for L2 execution
     * @param _gasPriceBid Gas price for L2 execution
     * @param _data Encoded maxSubmissionCost and extraData
     */
    function outboundTransferCustomRefund(
        address _l1Token,
        address _refundTo,
        address _to,
        uint256 _amount,
        uint256 _maxGas,
        uint256 _gasPriceBid,
        bytes calldata _data
    ) external payable returns (bytes memory);

    /**
     * @notice Calculate the submission fee for a retryable ticket
     * @param dataLength Length of the data being sent
     * @param baseFee Current base fee
     */
    function calculateRetryableSubmissionFee(
        uint256 dataLength,
        uint256 baseFee
    ) external view returns (uint256);
}
