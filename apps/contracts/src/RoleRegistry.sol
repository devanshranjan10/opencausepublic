// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title RoleRegistry
 * @notice Centralized role management for OpenCause
 */
contract RoleRegistry is AccessControl {
    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
    bytes32 public constant REVIEWER_ROLE = keccak256("REVIEWER_ROLE");
    bytes32 public constant VENDOR_ROLE = keccak256("VENDOR_ROLE");

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed admin);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed admin);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function grantOrganizer(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ORGANIZER_ROLE, account);
        emit RoleGranted(ORGANIZER_ROLE, account, msg.sender);
    }

    function grantReviewer(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(REVIEWER_ROLE, account);
        emit RoleGranted(REVIEWER_ROLE, account, msg.sender);
    }

    function grantVendor(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(VENDOR_ROLE, account);
        emit RoleGranted(VENDOR_ROLE, account, msg.sender);
    }

    function revokeOrganizer(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ORGANIZER_ROLE, account);
        emit RoleRevoked(ORGANIZER_ROLE, account, msg.sender);
    }

    function revokeReviewer(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(REVIEWER_ROLE, account);
        emit RoleRevoked(REVIEWER_ROLE, account, msg.sender);
    }

    function revokeVendor(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(VENDOR_ROLE, account);
        emit RoleRevoked(VENDOR_ROLE, account, msg.sender);
    }
}


