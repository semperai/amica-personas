// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockFlashLoanProvider
 * @notice Simulates a flash loan for testing
 */
contract MockFlashLoanProvider {
    function flashLoan(address token, uint256 amount, address receiver, bytes calldata data) external {
        // Transfer tokens to receiver
        IERC20(token).transfer(receiver, amount);

        // Execute receiver's logic
        (bool success,) = receiver.call(data);
        require(success, "Flash loan execution failed");

        // Require tokens to be returned
        require(IERC20(token).transferFrom(receiver, address(this), amount), "Flash loan not repaid");
    }
}
