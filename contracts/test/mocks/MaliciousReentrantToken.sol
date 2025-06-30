// contracts/mocks/MaliciousReentrantToken.sol
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IPersonaTokenFactory {
    function createPersona(
        address pairingToken,
        string memory name,
        string memory symbol,
        string[] memory metadataKeys,
        string[] memory metadataValues,
        uint256 initialBuyAmount
    ) external returns (uint256);

    function swapExactTokensForTokens(
        uint256 tokenId,
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) external returns (uint256);
}

contract MaliciousReentrantToken is ERC20 {
    address public target;
    string public attackFunction;
    bool private attacking;

    constructor(address _target, string memory _attackFunction)
        ERC20("Malicious", "MAL")
    {
        target = _target;
        attackFunction = _attackFunction;
        _mint(msg.sender, 1000000 ether);
    }

    function transferFrom(address from, address to, uint256 amount)
        public
        override
        returns (bool)
    {
        if (
            !attacking
                && keccak256(bytes(attackFunction))
                    == keccak256(bytes("createPersona"))
        ) {
            attacking = true;
            // Try to reenter
            try IPersonaTokenFactory(target).createPersona(
                address(this),
                "Reentrant",
                "REENT",
                new string[](0),
                new string[](0),
                0
            ) {
                // If this succeeds, reentrancy protection failed
            } catch {
                // Expected to fail
            }
            attacking = false;
        }
        return super.transferFrom(from, to, amount);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
