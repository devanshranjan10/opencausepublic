// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ServiceCredit
 * @notice Burns service codes to pay tariffs
 * @dev Scaffold implementation
 */
contract ServiceCredit is AccessControl, ReentrancyGuard {
    mapping(bytes32 => bool) public burnedCodes; // serviceCode => burned
    mapping(bytes32 => uint256) public codeValue; // serviceCode => value in wei

    event ServiceCodeBurned(bytes32 indexed serviceCode, address indexed burner, uint256 value);
    event ServiceCodeCreated(bytes32 indexed serviceCode, uint256 value);

    error CodeNotFound();
    error CodeAlreadyBurned();
    error InvalidValue();

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function createServiceCode(bytes32 serviceCode, uint256 value) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (value == 0) {
            revert InvalidValue();
        }
        codeValue[serviceCode] = value;
        emit ServiceCodeCreated(serviceCode, value);
    }

    function burnServiceCode(bytes32 serviceCode) external nonReentrant {
        if (codeValue[serviceCode] == 0) {
            revert CodeNotFound();
        }
        if (burnedCodes[serviceCode]) {
            revert CodeAlreadyBurned();
        }

        uint256 value = codeValue[serviceCode];
        burnedCodes[serviceCode] = true;

        emit ServiceCodeBurned(serviceCode, msg.sender, value);
    }

    function getServiceCodeValue(bytes32 serviceCode) external view returns (uint256) {
        return codeValue[serviceCode];
    }
}


