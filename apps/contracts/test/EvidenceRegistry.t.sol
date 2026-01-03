// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/EvidenceRegistry.sol";

contract EvidenceRegistryTest is Test {
    EvidenceRegistry registry;
    bytes32 campaignId = keccak256("test-campaign");
    bytes32 evidenceHash = keccak256("test-evidence");

    function setUp() public {
        registry = new EvidenceRegistry();
    }

    function testAnchorEvidence() public {
        registry.anchorEvidence(
            EvidenceRegistry.EvidenceKind.WITHDRAWAL_REQUEST,
            campaignId,
            evidenceHash,
            1000
        );

        EvidenceRegistry.EvidenceRecord memory record = registry.getEvidenceRecord(evidenceHash);
        assertEq(uint256(record.kind), uint256(EvidenceRegistry.EvidenceKind.WITHDRAWAL_REQUEST));
        assertEq(record.campaignId, campaignId);
        assertEq(record.evidenceHash, evidenceHash);
        assertEq(record.amount, 1000);
    }

    function testDuplicateEvidenceHash() public {
        registry.anchorEvidence(
            EvidenceRegistry.EvidenceKind.WITHDRAWAL_REQUEST,
            campaignId,
            evidenceHash,
            1000
        );

        vm.expectRevert(EvidenceRegistry.EvidenceHashAlreadyExists.selector);
        registry.anchorEvidence(
            EvidenceRegistry.EvidenceKind.WITHDRAWAL_REQUEST,
            campaignId,
            evidenceHash,
            2000
        );
    }
}


