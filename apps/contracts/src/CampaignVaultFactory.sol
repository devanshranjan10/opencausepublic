// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CampaignNativeVault.sol";
import "./CampaignTokenVault.sol";

/**
 * @title CampaignVaultFactory
 * @notice Factory for creating deterministic vault addresses using CREATE2
 * Supports creating native token vaults and ERC20 token vaults per campaign
 */
contract CampaignVaultFactory {
    address public treasurySafe; // Treasury multisig address
    
    // Mapping: campaignId => asset identifier => vault address
    // For native: assetId = address(0) or "NATIVE"
    // For ERC20: assetId = token contract address
    mapping(bytes32 => mapping(bytes32 => address)) public vaults;
    
    // Track all vaults for a campaign
    mapping(bytes32 => bytes32[]) public campaignAssets;
    
    event VaultCreated(
        bytes32 indexed campaignId,
        bytes32 indexed assetId,
        address indexed vault,
        bool isNative
    );

    error Unauthorized();
    error VaultAlreadyExists();

    constructor(address _treasurySafe) {
        treasurySafe = _treasurySafe;
    }

    /**
     * @notice Create a native token vault for a campaign
     * @param campaignId Unique campaign identifier
     * @return vault Address of the created vault
     */
    function createNativeVault(bytes32 campaignId) external returns (address vault) {
        bytes32 assetId = bytes32(uint256(0)); // Native token identifier
        
        if (vaults[campaignId][assetId] != address(0)) {
            revert VaultAlreadyExists();
        }
        
        // Use CREATE2 for deterministic address
        bytes32 salt = keccak256(abi.encodePacked(campaignId, assetId));
        bytes memory bytecode = abi.encodePacked(
            type(CampaignNativeVault).creationCode,
            abi.encode(campaignId, treasurySafe)
        );
        
        assembly {
            vault := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(vault) {
                revert(0, 0)
            }
        }
        
        vaults[campaignId][assetId] = vault;
        campaignAssets[campaignId].push(assetId);
        
        emit VaultCreated(campaignId, assetId, vault, true);
    }

    /**
     * @notice Create an ERC20 token vault for a campaign
     * @param campaignId Unique campaign identifier
     * @param token ERC20 token contract address
     * @return vault Address of the created vault
     */
    function createTokenVault(bytes32 campaignId, address token) external returns (address vault) {
        bytes32 assetId = bytes32(uint256(uint160(token)));
        
        if (vaults[campaignId][assetId] != address(0)) {
            revert VaultAlreadyExists();
        }
        
        // Use CREATE2 for deterministic address
        bytes32 salt = keccak256(abi.encodePacked(campaignId, assetId));
        bytes memory bytecode = abi.encodePacked(
            type(CampaignTokenVault).creationCode,
            abi.encode(campaignId, token, treasurySafe)
        );
        
        assembly {
            vault := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(vault) {
                revert(0, 0)
            }
        }
        
        vaults[campaignId][assetId] = vault;
        campaignAssets[campaignId].push(assetId);
        
        emit VaultCreated(campaignId, assetId, vault, false);
    }

    /**
     * @notice Get vault address for a campaign and asset
     * @param campaignId Campaign identifier
     * @param assetId Asset identifier (address(0) for native, token address for ERC20)
     * @return vault Vault address (zero if not created)
     */
    function getVault(bytes32 campaignId, bytes32 assetId) external view returns (address vault) {
        return vaults[campaignId][assetId];
    }

    /**
     * @notice Get all asset IDs for a campaign
     */
    function getCampaignAssets(bytes32 campaignId) external view returns (bytes32[] memory) {
        return campaignAssets[campaignId];
    }
}






