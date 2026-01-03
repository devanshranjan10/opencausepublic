// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/CampaignFactory.sol";
import "../src/RoleRegistry.sol";
import "../src/EvidenceRegistry.sol";

contract CampaignFactoryTest is Test {
    CampaignFactory factory;
    RoleRegistry roleRegistry;
    EvidenceRegistry evidenceRegistry;
    address organizer = address(0x1);
    bytes32 campaignId = keccak256("test-campaign");

    function setUp() public {
        roleRegistry = new RoleRegistry();
        evidenceRegistry = new EvidenceRegistry();
        factory = new CampaignFactory(address(roleRegistry), address(evidenceRegistry));

        vm.startPrank(address(this));
        roleRegistry.grantOrganizer(organizer);
        vm.stopPrank();
    }

    function testCreateCampaign() public {
        vm.startPrank(organizer);
        address vault = factory.createCampaign(campaignId, "Test Campaign");
        vm.stopPrank();

        assertNotEq(vault, address(0));
        assertEq(factory.getCampaignVault(campaignId), vault);
        assertEq(factory.getOrganizerCampaignCount(organizer), 1);
    }

    function testDuplicateCampaign() public {
        vm.startPrank(organizer);
        factory.createCampaign(campaignId, "Test Campaign");
        vm.expectRevert(CampaignFactory.CampaignAlreadyExists.selector);
        factory.createCampaign(campaignId, "Test Campaign 2");
        vm.stopPrank();
    }
}


