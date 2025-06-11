// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

contract ERC20Base is ERC20Upgradeable {
    constructor() ERC20Upgradeable() {
        _disableInitializers();
    }

    function initialize(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address owner
    ) public initializer {
        __ERC20_init(name, symbol);
        _mint(owner, initialSupply);
    }
}
