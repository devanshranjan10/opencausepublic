// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VoucherManager
 * @notice Manages voucher redemption for invoice-free mode
 * @dev Scaffold implementation
 */
contract VoucherManager is AccessControl, ReentrancyGuard {
    struct SKU {
        string name;
        uint256 cap; // Maximum amount per SKU
        uint256 claimed; // Total claimed so far
        bool active;
    }

    mapping(bytes32 => SKU) public skus; // skuId => SKU
    mapping(bytes32 => mapping(address => uint256)) public claimedByVendor; // skuId => vendor => amount

    event SKUCreated(bytes32 indexed skuId, string name, uint256 cap);
    event VoucherRedeemed(
        bytes32 indexed skuId,
        address indexed vendor,
        uint256 amount,
        uint256 actualPaid
    );

    error SKUNotFound();
    error SKUInactive();
    error CapExceeded();
    error InvalidAmount();

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function createSKU(bytes32 skuId, string memory name, uint256 cap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        skus[skuId] = SKU({name: name, cap: cap, claimed: 0, active: true});
        emit SKUCreated(skuId, name, cap);
    }

    function redeemVoucher(bytes32 skuId, address vendor, uint256 requestedAmount) external nonReentrant returns (uint256 actualPaid) {
        SKU storage sku = skus[skuId];
        if (sku.cap == 0) {
            revert SKUNotFound();
        }
        if (!sku.active) {
            revert SKUInactive();
        }
        if (requestedAmount == 0) {
            revert InvalidAmount();
        }

        uint256 available = sku.cap - sku.claimed;
        actualPaid = requestedAmount > available ? available : requestedAmount;

        sku.claimed += actualPaid;
        claimedByVendor[skuId][vendor] += actualPaid;

        emit VoucherRedeemed(skuId, vendor, actualPaid, actualPaid);
    }

    function getSKU(bytes32 skuId) external view returns (SKU memory) {
        return skus[skuId];
    }
}


