// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CampaignVault.sol";
import "./RoleRegistry.sol";
import "./EvidenceRegistry.sol";

/**
 * @title CampaignFactory
 * @notice Factory for creating campaign vaults with CREATE2 for deterministic addresses
 */
contract CampaignFactory {
    RoleRegistry public roleRegistry;
    EvidenceRegistry public evidenceRegistry;

    mapping(bytes32 => address) public campaignVaults; // campaignId => vault address
    mapping(address => bytes32[]) public organizerCampaigns; // organizer => campaignIds[]
    bytes32[] public allCampaigns;

    event CampaignCreated(
        bytes32 indexed campaignId,
        address indexed vault,
        address indexed organizer,
        string title
    );

    error CampaignAlreadyExists();
    error Unauthorized();

    constructor(address _roleRegistry, address _evidenceRegistry) {
        roleRegistry = RoleRegistry(_roleRegistry);
        evidenceRegistry = EvidenceRegistry(_evidenceRegistry);
    }

    function createCampaign(
        bytes32 campaignId,
        string memory title
    ) external returns (address vault) {
        if (campaignVaults[campaignId] != address(0)) {
            revert CampaignAlreadyExists();
        }

        // Check if caller has organizer role
        if (!roleRegistry.hasRole(roleRegistry.ORGANIZER_ROLE(), msg.sender)) {
            revert Unauthorized();
        }

        // Deploy vault with CREATE2 for deterministic address
        bytes32 salt = keccak256(abi.encodePacked(campaignId, msg.sender));
        bytes memory bytecode = abi.encodePacked(
            type(CampaignVault).creationCode,
            abi.encode(campaignId, msg.sender, address(roleRegistry), address(evidenceRegistry))
        );

        assembly {
            vault := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(vault) {
                revert(0, 0)
            }
        }

        campaignVaults[campaignId] = vault;
        organizerCampaigns[msg.sender].push(campaignId);
        allCampaigns.push(campaignId);

        emit CampaignCreated(campaignId, vault, msg.sender, title);
    }

    function getCampaignVault(bytes32 campaignId) external view returns (address) {
        return campaignVaults[campaignId];
    }

    function getOrganizerCampaignCount(address organizer) external view returns (uint256) {
        return organizerCampaigns[organizer].length;
    }

    function getAllCampaignsCount() external view returns (uint256) {
        return allCampaigns.length;
    }
}


