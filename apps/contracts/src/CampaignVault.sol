// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./RoleRegistry.sol";
import "./EvidenceRegistry.sol";

/**
 * @title CampaignVault
 * @notice Per-campaign escrow vault that holds funds and releases on milestone proof
 */
contract CampaignVault is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
    bytes32 public constant REVIEWER_ROLE = keccak256("REVIEWER_ROLE");

    struct Milestone {
        string name;
        uint256 capAmount;
        uint256 releasedAmount;
        bool isOpen;
        uint256 coolingOffEnds; // timestamp
        uint256 reviewWindowEnds; // timestamp
    }

    bytes32 public campaignId;
    address public organizer;
    RoleRegistry public roleRegistry;
    EvidenceRegistry public evidenceRegistry;

    mapping(uint256 => Milestone) public milestones;
    uint256 public milestoneCount;
    mapping(address => uint256) public balances; // token => amount
    mapping(address => bool) public allowedTokens;
    mapping(bytes32 => bool) public usedEvidenceHashes; // Prevent duplicate releases

    event Funded(address indexed token, address indexed donor, uint256 amount, bytes32 indexed campaignId);
    event MilestoneCreated(uint256 indexed milestoneId, string name, uint256 capAmount);
    event WithdrawalRequested(
        uint256 indexed milestoneId,
        address indexed token,
        uint256 amount,
        address payee,
        bytes32 evidenceHash
    );
    event Released(
        uint256 indexed milestoneId,
        address indexed token,
        uint256 amount,
        address payee,
        bytes32 evidenceHash,
        bytes32 indexed campaignId
    );
    event CampaignPaused(bytes32 indexed campaignId);
    event CampaignUnpaused(bytes32 indexed campaignId);

    error Unauthorized();
    error InvalidMilestone();
    error InsufficientFunds();
    error MilestoneCapExceeded();
    error MilestoneNotOpen();
    error CoolingOffNotPassed();
    error DuplicateEvidenceHash();
    error TokenNotAllowed();
    error InvalidAmount();

    constructor(
        bytes32 _campaignId,
        address _organizer,
        address _roleRegistry,
        address _evidenceRegistry
    ) {
        campaignId = _campaignId;
        organizer = _organizer;
        roleRegistry = RoleRegistry(_roleRegistry);
        evidenceRegistry = EvidenceRegistry(_evidenceRegistry);
        _grantRole(ORGANIZER_ROLE, _organizer);
    }

    /**
     * Fund the vault with ERC20 tokens
     */
    function fund(address token, uint256 amount) external nonReentrant whenNotPaused {
        if (!allowedTokens[token] && token != address(0)) {
            revert TokenNotAllowed();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[token] += amount;

        emit Funded(token, msg.sender, amount, campaignId);
    }

    /**
     * Receive native token (ETH/MATIC) donations
     * This allows direct transfers to the vault address
     */
    receive() external payable {
        if (msg.value == 0) {
            revert InvalidAmount();
        }
        balances[address(0)] += msg.value;
        emit Funded(address(0), msg.sender, msg.value, campaignId);
    }

    /**
     * Fallback function for native token donations
     */
    fallback() external payable {
        if (msg.value == 0) {
            revert InvalidAmount();
        }
        balances[address(0)] += msg.value;
        emit Funded(address(0), msg.sender, msg.value, campaignId);
    }

    function createMilestone(
        string memory name,
        uint256 capAmount,
        uint256 coolingOffHours,
        uint256 reviewWindowHours
    ) external onlyRole(ORGANIZER_ROLE) {
        uint256 milestoneId = milestoneCount;
        milestones[milestoneId] = Milestone({
            name: name,
            capAmount: capAmount,
            releasedAmount: 0,
            isOpen: true,
            coolingOffEnds: block.timestamp + (coolingOffHours * 1 hours),
            reviewWindowEnds: block.timestamp + ((coolingOffHours + reviewWindowHours) * 1 hours)
        });
        milestoneCount++;

        emit MilestoneCreated(milestoneId, name, capAmount);
    }

    function requestWithdrawal(
        uint256 milestoneId,
        address token,
        uint256 amount,
        address payee,
        bytes32 evidenceHash
    ) external onlyRole(ORGANIZER_ROLE) nonReentrant whenNotPaused {
        Milestone storage milestone = milestones[milestoneId];
        if (milestone.capAmount == 0) {
            revert InvalidMilestone();
        }
        if (!milestone.isOpen) {
            revert MilestoneNotOpen();
        }
        if (block.timestamp < milestone.coolingOffEnds) {
            revert CoolingOffNotPassed();
        }
        if (usedEvidenceHashes[evidenceHash]) {
            revert DuplicateEvidenceHash();
        }
        if (amount == 0 || balances[token] < amount) {
            revert InsufficientFunds();
        }
        if (milestone.releasedAmount + amount > milestone.capAmount) {
            revert MilestoneCapExceeded();
        }

        usedEvidenceHashes[evidenceHash] = true;

        // Anchor evidence
        evidenceRegistry.anchorEvidence(
            EvidenceRegistry.EvidenceKind.WITHDRAWAL_REQUEST,
            campaignId,
            evidenceHash,
            amount
        );

        emit WithdrawalRequested(milestoneId, token, amount, payee, evidenceHash);
    }

    function release(
        uint256 milestoneId,
        address token,
        uint256 amount,
        address payee,
        bytes32 evidenceHash
    ) external onlyRole(REVIEWER_ROLE) nonReentrant whenNotPaused {
        Milestone storage milestone = milestones[milestoneId];
        if (milestone.capAmount == 0) {
            revert InvalidMilestone();
        }
        if (amount == 0 || balances[token] < amount) {
            revert InsufficientFunds();
        }
        if (milestone.releasedAmount + amount > milestone.capAmount) {
            revert MilestoneCapExceeded();
        }

        milestone.releasedAmount += amount;
        balances[token] -= amount;

        // Handle native token vs ERC20
        if (token == address(0)) {
            // Native token transfer
            (bool success, ) = payee.call{value: amount}("");
            require(success, "Native token transfer failed");
        } else {
            // ERC20 token transfer
            IERC20(token).safeTransfer(payee, amount);
        }

        emit Released(milestoneId, token, amount, payee, evidenceHash, campaignId);
    }

    function allowToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        allowedTokens[token] = true;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit CampaignPaused(campaignId);
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit CampaignUnpaused(campaignId);
    }

    function getMilestone(uint256 milestoneId) external view returns (Milestone memory) {
        return milestones[milestoneId];
    }
}


