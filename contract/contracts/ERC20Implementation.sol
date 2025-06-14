// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title ERC20Implementation
 * @notice Implementation contract for cloneable ERC20 tokens
 */
contract ERC20Implementation is Initializable, ERC20Upgradeable {
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,
        address owner_
    ) external initializer {
        require(owner_ != address(0), "Invalid owner");
        require(initialSupply_ > 0, "Invalid supply");

        __ERC20_init(name_, symbol_);
        _mint(owner_, initialSupply_);
    }
}