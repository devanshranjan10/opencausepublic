// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title EvidenceRegistry
 * @notice Anchors evidence hashes on-chain for transparency
 */
contract EvidenceRegistry {
    enum EvidenceKind {
        INR_DONATION,
        WITHDRAWAL_REQUEST,
        MILESTONE_PROOF
    }

    struct EvidenceRecord {
        EvidenceKind kind;
        bytes32 campaignId; // bytes32 hash of campaign ID
        bytes32 evidenceHash;
        address submitter;
        uint256 amount; // 0 if not applicable
        uint256 timestamp;
    }

    mapping(bytes32 => EvidenceRecord) public evidenceRecords;
    mapping(bytes32 => bool) public evidenceHashExists; // Prevent duplicates
    mapping(bytes32 => bytes32[]) public campaignEvidence; // campaignId => evidenceHash[]

    event EvidenceAnchored(
        bytes32 indexed evidenceHash,
        EvidenceKind indexed kind,
        bytes32 indexed campaignId,
        address submitter,
        uint256 amount
    );

    error EvidenceHashAlreadyExists();
    error InvalidEvidenceHash();

    function anchorEvidence(
        EvidenceKind kind,
        bytes32 campaignId,
        bytes32 evidenceHash,
        uint256 amount
    ) external {
        if (evidenceHash == bytes32(0)) {
            revert InvalidEvidenceHash();
        }

        if (evidenceHashExists[evidenceHash]) {
            revert EvidenceHashAlreadyExists();
        }

        EvidenceRecord memory record = EvidenceRecord({
            kind: kind,
            campaignId: campaignId,
            evidenceHash: evidenceHash,
            submitter: msg.sender,
            amount: amount,
            timestamp: block.timestamp
        });

        evidenceRecords[evidenceHash] = record;
        evidenceHashExists[evidenceHash] = true;
        campaignEvidence[campaignId].push(evidenceHash);

        emit EvidenceAnchored(evidenceHash, kind, campaignId, msg.sender, amount);
    }

    function getEvidenceRecord(bytes32 evidenceHash) external view returns (EvidenceRecord memory) {
        return evidenceRecords[evidenceHash];
    }

    function getCampaignEvidenceCount(bytes32 campaignId) external view returns (uint256) {
        return campaignEvidence[campaignId].length;
    }

    function getCampaignEvidence(bytes32 campaignId, uint256 index) external view returns (bytes32) {
        return campaignEvidence[campaignId][index];
    }
}


