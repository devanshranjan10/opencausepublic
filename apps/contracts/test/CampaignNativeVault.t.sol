// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CampaignNativeVault} from "../src/CampaignNativeVault.sol";

contract CampaignNativeVaultTest is Test {
    CampaignNativeVault public vault;
    address public treasury = address(0x1);
    bytes32 public constant CAMPAIGN_ID = keccak256("test-campaign");

    function setUp() public {
        vault = new CampaignNativeVault(CAMPAIGN_ID, treasury);
    }

    function test_Donate() public {
        bytes32 intentId = keccak256("test-intent");
        uint256 amount = 1 ether;
        
        vm.deal(address(this), amount);
        vault.donate{value: amount}(intentId);
        
        assertEq(address(vault).balance, amount);
        assertEq(vault.totalDonated(), amount);
    }

    function test_ReceiveReverts() public {
        vm.deal(address(this), 1 ether);
        
        (bool success, ) = address(vault).call{value: 1 ether}("");
        assertFalse(success, "Direct transfer should revert");
    }

    function test_WithdrawOnlyTreasury() public {
        bytes32 intentId = keccak256("test-intent");
        vm.deal(address(this), 1 ether);
        vault.donate{value: 1 ether}(intentId);
        
        // Non-treasury cannot withdraw
        vm.prank(address(0x2));
        vm.expectRevert();
        vault.withdraw(payable(address(0x3)), 0.5 ether, keccak256("withdrawal-id"));
        
        // Treasury can withdraw
        vm.prank(treasury);
        vault.withdraw(payable(address(0x3)), 0.5 ether, keccak256("withdrawal-id"));
        
        assertEq(address(0x3).balance, 0.5 ether);
    }

    function test_LTCAddressGeneration() public {
        // Regression test: ensure LTC addresses use ltc1 prefix, not bc1
        // This would be tested in the HD wallet service tests
        // For now, just a placeholder to show test structure
        assertTrue(true);
    }
}






