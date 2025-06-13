// contracts/mocks/MockUniswapV2Pair.sol
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUniswapV2Pair is ERC20 {
    address public token0;
    address public token1;

    constructor() ERC20("Uniswap V2", "UNI-V2") {}

    function initialize(address _token0, address _token1) external {
        token0 = _token0;
        token1 = _token1;
    }

    function mint(address to) external returns (uint liquidity) {
        liquidity = 1000 ether; // Mock liquidity amount
        _mint(to, liquidity);
    }
}
