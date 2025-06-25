// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./shared/Fixtures.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

contract PersonaTokenFactoryPauseTest is Fixtures {
    function setUp() public override {
        super.setUp();
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

    function test_CreatePersona_WhenPaused() public {
        // Pause the contract
        vm.prank(factoryOwner);
        personaFactory.pause();

        // Try to create persona when paused
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), DEFAULT_MINT_COST);

        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            "test.persona",
            0, // no initial buy
            address(0), // no agent token
            0 // no min agent tokens
        );
    }

    function test_SwapExactTokensForTokens_WhenPaused() public {
        // First create a persona
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), DEFAULT_MINT_COST);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            "test",
            0, // no initial buy
            address(0), // no agent token
            0 // no min agent tokens
        );

        // Pause the contract
        vm.prank(factoryOwner);
        personaFactory.pause();

        // Try to swap when paused
        vm.prank(user2);
        amicaToken.approve(address(personaFactory), 1000 ether);

        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        personaFactory.swapExactTokensForTokens(tokenId, 1000 ether, 0, user2, block.timestamp + 300);
    }

    function test_SwapExactTokensForPairingTokens_WhenPaused() public {
        // First create a persona and buy some tokens
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), DEFAULT_MINT_COST);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            "testsell",
            0, // no initial buy
            address(0), // no agent token
            0 // no min agent tokens
        );

        // Buy some tokens first
        vm.prank(user2);
        amicaToken.approve(address(personaFactory), 1000 ether);
        personaFactory.swapExactTokensForTokens(tokenId, 1000 ether, 0, user2, block.timestamp + 300);

        // Pause the contract
        vm.prank(factoryOwner);
        personaFactory.pause();

        // Try to sell when paused
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        personaFactory.swapExactTokensForPairingTokens(tokenId, 100 ether, 0, user2, block.timestamp + 300);
    }

    function test_WithdrawTokens_WhenPaused() public {
        // Setup: create persona and graduate it
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), DEFAULT_MINT_COST);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            "testwithdraw",
            0, // no initial buy
            address(0), // no agent token
            0 // no min agent tokens
        );

        // Buy enough to graduate
        vm.prank(user2);
        amicaToken.approve(address(personaFactory), DEFAULT_GRADUATION_THRESHOLD);
        personaFactory.swapExactTokensForTokens(tokenId, DEFAULT_GRADUATION_THRESHOLD, 0, user2, block.timestamp + 300);

        // Verify it's graduated
        (,,,,, bool pairCreated,,,,,) = personaFactory.personas(tokenId);
        assertTrue(pairCreated, "Persona should be graduated");

        // Pause the contract
        vm.prank(factoryOwner);
        personaFactory.pause();

        // Try to withdraw when paused
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        personaFactory.withdrawTokens(tokenId);
    }

    function test_DepositAgentTokens_WhenPaused() public {
        // Create a mock agent token
        MockERC20 agentToken = new MockERC20("Agent Token", "AGENT", 18);
        agentToken.mint(user2, 10000 ether);

        // Create persona with agent token
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), DEFAULT_MINT_COST);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            "testagent",
            0,
            address(agentToken),
            1000 ether // min agent tokens
        );

        // Pause the contract
        vm.prank(factoryOwner);
        personaFactory.pause();

        // Try to deposit agent tokens when paused
        vm.prank(user2);
        agentToken.approve(address(personaFactory), 1000 ether);

        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        personaFactory.depositAgentTokens(tokenId, 1000 ether);
    }

    function test_WithdrawAgentTokens_WhenPaused() public {
        // Create a mock agent token
        MockERC20 agentToken = new MockERC20("Agent Token", "AGENT", 18);
        agentToken.mint(user2, 10000 ether);

        // Create persona with agent token
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), DEFAULT_MINT_COST);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken), "Test Persona", "TEST", "testagent2", 0, address(agentToken), 1000 ether
        );

        // Deposit some agent tokens first
        vm.prank(user2);
        agentToken.approve(address(personaFactory), 500 ether);
        personaFactory.depositAgentTokens(tokenId, 500 ether);

        // Pause the contract
        vm.prank(factoryOwner);
        personaFactory.pause();

        // Try to withdraw agent tokens when paused
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        personaFactory.withdrawAgentTokens(tokenId, 250 ether);
    }

    function test_Operations_AfterUnpause() public {
        // Pause the contract
        vm.prank(factoryOwner);
        personaFactory.pause();

        // Verify operations fail when paused
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), DEFAULT_MINT_COST);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        personaFactory.createPersona(address(amicaToken), "Test Persona", "TEST", "testunpause", 0, address(0), 0);

        // Unpause the contract
        vm.prank(factoryOwner);
        personaFactory.unpause();

        // Now operations should work
        vm.prank(user1);
        uint256 tokenId =
            personaFactory.createPersona(address(amicaToken), "Test Persona", "TEST", "testunpause", 0, address(0), 0);

        // Verify persona was created
        (string memory name,, address token,,,,,,,,) = personaFactory.personas(tokenId);
        assertEq(name, "Test Persona");
        assertTrue(token != address(0));
    }
}
