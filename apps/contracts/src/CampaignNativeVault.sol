// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CampaignNativeVault
 * @notice Vault for native token (ETH/MATIC/etc) donations per campaign
 * @dev Receives native tokens via donate() with intentId tracking
 * receive() MUST revert to force intentId capture
 */
contract CampaignNativeVault is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    
    bytes32 public immutable campaignId;
    address public immutable treasury;
    
    uint256 public totalDonated;
    
    event DonationReceived(
        bytes32 indexed campaignId,
        bytes32 indexed intentId,
        address indexed donor,
        uint256 amount,
        uint256 timestamp
    );
    
    event WithdrawalExecuted(
        bytes32 indexed campaignId,
        address indexed to,
        uint256 amount,
        bytes32 indexed withdrawalId,
        uint256 timestamp
    );

    error InvalidAmount();
    error Unauthorized();
    error DirectTransferNotAllowed(); // receive() must revert

    constructor(bytes32 _campaignId, address _treasury) {
        campaignId = _campaignId;
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, _treasury);
        _grantRole(TREASURY_ROLE, _treasury);
    }

    /**
     * @notice Donate native tokens to the campaign
     * @param intentId Payment intent identifier for tracking
     */
    function donate(bytes32 intentId) external payable nonReentrant whenNotPaused {
        if (msg.value == 0) {
            revert InvalidAmount();
        }
        
        totalDonated += msg.value;
        
        emit DonationReceived(
            campaignId,
            intentId,
            msg.sender,
            msg.value,
            block.timestamp
        );
    }

    /**
     * @notice CRITICAL: receive() MUST revert to force intentId capture
     * All donations must go through donate(bytes32 intentId)
     */
    receive() external payable {
        revert DirectTransferNotAllowed();
    }

    /**
     * @notice CRITICAL: fallback() MUST revert to force intentId capture
     */
    fallback() external payable {
        revert DirectTransferNotAllowed();
    }

    /**
     * @notice Withdraw funds (only treasury)
     * @param to Recipient address
     * @param amount Amount to withdraw
     * @param withdrawalId Withdrawal identifier for tracking
     */
    function withdraw(
        address payable to,
        uint256 amount,
        bytes32 withdrawalId
    ) external onlyRole(TREASURY_ROLE) nonReentrant whenNotPaused {
        if (amount == 0 || address(this).balance < amount) {
            revert InvalidAmount();
        }
        
        (bool success, ) = to.call{value: amount}("");
        require(success, "Withdrawal failed");
        
        emit WithdrawalExecuted(
            campaignId,
            to,
            amount,
            withdrawalId,
            block.timestamp
        );
    }

    /**
     * @notice Get contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Pause contract (only treasury)
     */
    function pause() external onlyRole(TREASURY_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract (only treasury)
     */
    function unpause() external onlyRole(TREASURY_ROLE) {
        _unpause();
    }
}






