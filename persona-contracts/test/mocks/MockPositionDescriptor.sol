// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPositionDescriptor} from "@uniswap/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

contract MockPositionDescriptor is IPositionDescriptor {
    IPoolManager public immutable poolManager;
    address public immutable wrappedNative;
    string public constant nativeCurrencyLabel = "ETH";
    
    constructor(IPoolManager _poolManager, address _wrappedNative) {
        poolManager = _poolManager;
        wrappedNative = _wrappedNative;
    }
    
    function tokenURI(IPositionManager, uint256 tokenId) external pure override returns (string memory) {
        return string(abi.encodePacked("https://example.com/token/", toString(tokenId)));
    }
    
    function flipRatio(address, address) external pure override returns (bool) {
        return false;
    }
    
    function currencyRatioPriority(address) external pure override returns (int256) {
        return 0;
    }
    
    // Helper function to convert uint256 to string
    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
