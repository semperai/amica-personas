pragma solidity ^0.8.26;

import {IWETH9} from "@uniswap/v4-periphery/src/interfaces/external/IWETH9.sol";

contract MockWETH9 is IWETH9 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function deposit() external payable override {
        balanceOf[msg.sender] += msg.value;
    }

    function withdraw(uint256 wad) external override {
        require(balanceOf[msg.sender] >= wad);
        balanceOf[msg.sender] -= wad;
        payable(msg.sender).transfer(wad);
    }

    function approve(address guy, uint256 wad) external override returns (bool) {
        allowance[msg.sender][guy] = wad;
        return true;
    }

    function transfer(address dst, uint256 wad) external override returns (bool) {
        return _transferFrom(msg.sender, dst, wad);
    }

    function transferFrom(address src, address dst, uint256 wad) external override returns (bool) {
        return _transferFrom(src, dst, wad);
    }

    function _transferFrom(address src, address dst, uint256 wad) internal returns (bool) {
        require(balanceOf[src] >= wad);
        if (src != msg.sender && allowance[src][msg.sender] != type(uint256).max) {
            require(allowance[src][msg.sender] >= wad);
            allowance[src][msg.sender] -= wad;
        }
        balanceOf[src] -= wad;
        balanceOf[dst] += wad;
        return true;
    }

    function totalSupply() external pure override returns (uint256) {
        return 0;
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function symbol() external pure returns (string memory) {
        return "WETH";
    }

    function name() external pure returns (string memory) {
        return "Wrapped Ether";
    }
}
