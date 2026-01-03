// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CampaignVaultFactory} from "../src/CampaignVaultFactory.sol";
import {CampaignNativeVault} from "../src/CampaignNativeVault.sol";
import {CampaignTokenVault} from "../src/CampaignTokenVault.sol";

contract CampaignVaultTest is Test {
    CampaignVaultFactory factory;
    address treasury = address(0xBEEF);
    bytes32 constant CAMPAIGN_ID = keccak256("camp1");
    bytes32 constant INTENT_ID = keccak256("intent1");
    
    // Mock token for ERC20 vault tests
    IERC20 token;

    function setUp() public {
        // Deploy factory (you'll need to pass roleRegistry and evidenceRegistry addresses)
        // For this test, we'll assume they're deployed separately
        address roleRegistry = address(0x1);
        address evidenceRegistry = address(0x2);
        factory = new CampaignVaultFactory(roleRegistry, evidenceRegistry);
        
        // For native vault tests, we'll test the vault directly
        CampaignNativeVault nativeVault = new CampaignNativeVault(
            CAMPAIGN_ID,
            treasury
        );
        
        // Store vault address for testing
        vm.store(address(nativeVault), bytes32(0), bytes32(uint256(uint160(address(nativeVault)))));
    }

    function test_NativeVaultDonateEmitsIntentId() public {
        CampaignNativeVault vault = new CampaignNativeVault(CAMPAIGN_ID, treasury);
        
        vm.expectEmit(true, true, true, true);
        emit CampaignNativeVault.DonationReceived(
            CAMPAIGN_ID,
            INTENT_ID,
            address(this),
            1 ether,
            block.timestamp
        );
        
        vm.deal(address(this), 1 ether);
        vault.donate{value: 1 ether}(INTENT_ID);
    }

    function test_NativeVaultReceiveReverts() public {
        CampaignNativeVault vault = new CampaignNativeVault(CAMPAIGN_ID, treasury);
        vm.deal(address(this), 1 ether);
        
        // Direct transfer should revert
        (bool success, ) = address(vault).call{value: 1 ether}("");
        assertFalse(success, "Direct transfer should revert");
    }

    function test_NativeVaultWithdrawRestricted() public {
        CampaignNativeVault vault = new CampaignNativeVault(CAMPAIGN_ID, treasury);
        bytes32 withdrawalId = keccak256("withdrawal1");
        
        // Donate first
        vm.deal(address(this), 1 ether);
        vault.donate{value: 1 ether}(INTENT_ID);
        
        address recipient = address(0xCAFE);
        
        // Non-treasury cannot withdraw
        vm.prank(address(0xDEAD));
        vm.expectRevert();
        vault.withdraw(payable(recipient), 0.5 ether, withdrawalId);
        
        // Treasury can withdraw
        vm.prank(treasury);
        vault.withdraw(payable(recipient), 0.5 ether, withdrawalId);
        
        assertEq(recipient.balance, 0.5 ether);
    }

    function test_NativeVaultTotalDonatedIncrements() public {
        CampaignNativeVault vault = new CampaignNativeVault(CAMPAIGN_ID, treasury);
        
        vm.deal(address(this), 2 ether);
        vault.donate{value: 1 ether}(INTENT_ID);
        assertEq(vault.totalDonated(), 1 ether);
        
        vault.donate{value: 1 ether}(INTENT_ID);
        assertEq(vault.totalDonated(), 2 ether);
    }

    function test_NativeVaultCannotDonateZero() public {
        CampaignNativeVault vault = new CampaignNativeVault(CAMPAIGN_ID, treasury);
        
        vm.expectRevert(CampaignNativeVault.InvalidAmount.selector);
        vault.donate(INTENT_ID);
    }

    function test_Fuzz_DonateAnyAmount(uint256 amount) public {
        CampaignNativeVault vault = new CampaignNativeVault(CAMPAIGN_ID, treasury);
        
        vm.assume(amount > 0 && amount < type(uint128).max);
        vm.deal(address(this), amount);
        
        vault.donate{value: amount}(INTENT_ID);
        assertEq(vault.totalDonated(), amount);
        assertEq(address(vault).balance, amount);
    }
}

// Minimal ERC20 interface for testing
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}