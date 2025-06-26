// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";

contract PersonaTokenFactoryAdminTest is Fixtures {
    function setUp() public override {
        super.setUp();

        // The test contract needs to approve the factory to spend its tokens
        amicaToken.approve(address(personaFactory), type(uint256).max);
    }

    function test_ConfigurePairingToken_AsOwner() public {
        // Deploy a test token
        MockERC20 testToken = new MockERC20("Test Token", "TEST", 18);
        
        uint256 customMintCost = 500 ether;
        uint256 customThreshold = 500_000 ether;
        
        // Configure the pairing token as owner
        vm.prank(factoryOwner);
        vm.expectEmit(true, false, false, false);
        emit PersonaTokenFactory.PairingConfigUpdated(address(testToken));
        
        personaFactory.configurePairingToken(
            address(testToken),
            customMintCost,
            customThreshold,
            true // enabled
        );
        
        // Verify configuration
        (bool enabled, uint256 mintCost, uint256 graduationThreshold) = personaFactory.pairingConfigs(address(testToken));
        assertTrue(enabled);
        assertEq(mintCost, customMintCost);
        assertEq(graduationThreshold, customThreshold);
    }
    
    function test_DisablePairingToken_AsOwner() public {
        // First check that AMICA token is enabled by default
        (bool enabled,,) = personaFactory.pairingConfigs(address(amicaToken));
        assertTrue(enabled);
        
        // Disable AMICA token as owner
        vm.prank(factoryOwner);
        vm.expectEmit(true, false, false, false);
        emit PersonaTokenFactory.PairingConfigUpdated(address(amicaToken));
        
        personaFactory.configurePairingToken(
            address(amicaToken),
            0, // mint cost doesn't matter when disabling
            0, // threshold doesn't matter when disabling
            false // disabled
        );
        
        // Verify it's disabled
        (enabled,,) = personaFactory.pairingConfigs(address(amicaToken));
        assertFalse(enabled);
    }
    
    function test_ConfigurePairingToken_RevertNonOwner() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user1));
        
        personaFactory.configurePairingToken(
            user1,
            100 ether,
            100_000 ether,
            true
        );
    }
    
    function test_ConfigurePairingToken_RevertZeroAddress() public {
        vm.prank(factoryOwner);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 0)); // Invalid token = 0
        
        personaFactory.configurePairingToken(
            address(0),
            100 ether,
            100_000 ether,
            true
        );
    }
    
    function test_Pause_OnlyOwner() public {
        // Non-owner cannot pause
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user1));
        personaFactory.pause();

        // Owner can pause
        vm.prank(factoryOwner);
        personaFactory.pause();

        assertTrue(personaFactory.paused());
    }

    function test_Unpause_OnlyOwner() public {
        // First pause as owner
        vm.prank(factoryOwner);
        personaFactory.pause();

        // Non-owner cannot unpause
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", user1));
        personaFactory.unpause();

        // Owner can unpause
        vm.prank(factoryOwner);
        personaFactory.unpause();

        assertFalse(personaFactory.paused());
    }
    
    function test_Pause_Unpause_WithCreation() public {
        // Pause the contract
        vm.prank(factoryOwner);
        personaFactory.pause();
        
        // Try to create persona while paused
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), 1000 ether);
        
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("pausetest"),
            0,
            address(0),
            0
        );
        
        // Unpause
        vm.prank(factoryOwner);
        personaFactory.unpause();
        
        // Now should work
        vm.prank(user1);
        // We only check the first two indexed parameters (tokenId and domain) 
        // and skip the token address since we don't know it beforehand
        vm.expectEmit(true, true, false, false);
        emit PersonaTokenFactory.PersonaCreated(1, bytes32("pausetest2"), address(0));
        
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("pausetest2"),
            0,
            address(0),
            0
        );
        
        assertEq(tokenId, 1);
    }
    
    function test_EnableAndDisablePairingToken() public {
        // Deploy a new token
        MockERC20 newToken = new MockERC20("New Token", "NEW", 18);
        newToken.mint(user1, 10_000_000 ether);
        
        // Configure and enable the token
        vm.prank(factoryOwner);
        personaFactory.configurePairingToken(
            address(newToken),
            2000 ether,
            2_000_000 ether,
            true
        );
        
        // Verify user can create persona with the new token
        vm.startPrank(user1);
        newToken.approve(address(personaFactory), 2000 ether);
        
        uint256 tokenId = personaFactory.createPersona(
            address(newToken),
            "Test New",
            "TESTN",
            bytes32("testnew"),
            0,
            address(0),
            0
        );
        vm.stopPrank();
        
        assertEq(tokenId, 1);
        
        // Now disable the token
        vm.prank(factoryOwner);
        personaFactory.configurePairingToken(
            address(newToken),
            2000 ether,
            2_000_000 ether,
            false
        );
        
        // Verify user cannot create persona with disabled token
        vm.startPrank(user1);
        newToken.approve(address(personaFactory), 2000 ether);
        
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 1)); // Not enabled = 1
        personaFactory.createPersona(
            address(newToken),
            "Test New 2",
            "TESTN2",
            bytes32("testnew2"),
            0,
            address(0),
            0
        );
        vm.stopPrank();
    }
    
    function test_MultiplePairingTokenConfiguration() public {
        // Deploy multiple test tokens
        MockERC20 token1 = new MockERC20("Token 1", "TK1", 18);
        MockERC20 token2 = new MockERC20("Token 2", "TK2", 18);
        MockERC20 token3 = new MockERC20("Token 3", "TK3", 18);
        
        // Configure all three tokens with different parameters
        vm.startPrank(factoryOwner);
        
        personaFactory.configurePairingToken(
            address(token1),
            100 ether,
            100_000 ether,
            true
        );
        
        personaFactory.configurePairingToken(
            address(token2),
            500 ether,
            500_000 ether,
            true
        );
        
        personaFactory.configurePairingToken(
            address(token3),
            1000 ether,
            1_000_000 ether,
            true
        );
        
        vm.stopPrank();
        
        // Verify all configurations
        (bool enabled1, uint256 mintCost1, uint256 threshold1) = personaFactory.pairingConfigs(address(token1));
        assertTrue(enabled1);
        assertEq(mintCost1, 100 ether);
        assertEq(threshold1, 100_000 ether);
        
        (bool enabled2, uint256 mintCost2, uint256 threshold2) = personaFactory.pairingConfigs(address(token2));
        assertTrue(enabled2);
        assertEq(mintCost2, 500 ether);
        assertEq(threshold2, 500_000 ether);
        
        (bool enabled3, uint256 mintCost3, uint256 threshold3) = personaFactory.pairingConfigs(address(token3));
        assertTrue(enabled3);
        assertEq(mintCost3, 1000 ether);
        assertEq(threshold3, 1_000_000 ether);
    }
}
