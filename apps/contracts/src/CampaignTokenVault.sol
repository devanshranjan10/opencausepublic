// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CampaignTokenVault
 * @notice Vault for ERC20 token donations per campaign
 * @dev Receives ERC20 tokens via donate() with intentId tracking
 */
contract CampaignTokenVault is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    
    bytes32 public immutable campaignId;
    IERC20 public immutable token;
    address public immutable treasury;
    
    uint256 public totalDonated;
    
    event DonationReceived(
        bytes32 indexed campaignId,
        bytes32 indexed intentId,
        address indexed donor,
        address token,
        uint256 amount,
        uint256 timestamp
    );
    
    event WithdrawalExecuted(
        bytes32 indexed campaignId,
        address indexed to,
        address token,
        uint256 amount,
        bytes32 indexed withdrawalId,
        uint256 timestamp
    );

    error InvalidAmount();
    error TransferFailed();

    constructor(
        bytes32 _campaignId,
        address _token,
        address _treasury
    ) {
        campaignId = _campaignId;
        token = IERC20(_token);
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, _treasury);
        _grantRole(TREASURY_ROLE, _treasury);
    }

    /**
     * @notice Donate ERC20 tokens to the campaign
     * @param intentId Payment intent identifier for tracking
     * @param amount Amount of tokens to donate
     * @dev User must approve this contract first
     */
    function donate(bytes32 intentId, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) {
            revert InvalidAmount();
        }
        
        token.safeTransferFrom(msg.sender, address(this), amount);
        totalDonated += amount;
        
        emit DonationReceived(
            campaignId,
            intentId,
            msg.sender,
            address(token),
            amount,
            block.timestamp
        );
    }

    /**
     * @notice Withdraw tokens (only treasury)
     * @param to Recipient address
     * @param amount Amount to withdraw
     * @param withdrawalId Withdrawal identifier for tracking
     */
    function withdraw(
        address to,
        uint256 amount,
        bytes32 withdrawalId
    ) external onlyRole(TREASURY_ROLE) nonReentrant whenNotPaused {
        if (amount == 0) {
            revert InvalidAmount();
        }
        
        token.safeTransfer(to, amount);
        
        emit WithdrawalExecuted(
            campaignId,
            to,
            address(token),
            amount,
            withdrawalId,
            block.timestamp
        );
    }

    /**
     * @notice Get contract balance
     */
    function getBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
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






