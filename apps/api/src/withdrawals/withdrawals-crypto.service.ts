import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from "@nestjs/common";
import { FirebaseService } from "../firebase/firebase.service";
import { FirestoreRepository } from "@opencause/firebase";
import { randomBytes, createHash } from "crypto";
import * as admin from "firebase-admin";
import { getNetwork, getAsset } from "@opencause/crypto-core";

export interface CreateWithdrawalDto {
  campaignId: string;
  assetId: string;
  networkId: string;
  amountNative: string;
  toAddress: string;
  proofCids: string[]; // IPFS CIDs for proof documents
}

export interface WithdrawalResponse {
  withdrawalId: string;
  campaignId: string;
  assetId: string;
  networkId: string;
  amountNative: string;
  toAddress: string;
  proofCids: string[];
  status: string;
  createdAt: string;
}

@Injectable()
export class WithdrawalsCryptoService {
  private repo: FirestoreRepository;

  constructor(private firebase: FirebaseService) {
    this.repo = new FirestoreRepository(firebase.firestore);
  }

  /**
   * Create a withdrawal request
   */
  async createWithdrawal(userId: string, dto: CreateWithdrawalDto): Promise<WithdrawalResponse> {
    // Verify user is organizer of campaign
    const campaign = await this.repo.getCampaign(dto.campaignId);
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    // TODO: Check user role and ownership
    // For now, allow if user has organizer role

    // Validate network and asset
    const network = getNetwork(dto.networkId);
    const asset = getAsset(dto.assetId);

    if (!network || !asset) {
      throw new BadRequestException("Invalid network or asset");
    }

    // Check campaign has sufficient balance
    const stats = await this.repo.getCampaignStats(dto.campaignId);
    const assetKey = `${dto.assetId}_${dto.networkId}`;
    const balance = stats?.balanceByAsset?.[assetKey] || "0";

    if (BigInt(dto.amountNative) > BigInt(balance)) {
      throw new BadRequestException("Insufficient balance");
    }

    // Generate withdrawal ID
    const withdrawalId = this.generateWithdrawalId();

    // Create withdrawal request
    const withdrawal = await this.repo.createWithdrawal(withdrawalId, {
      campaignId: dto.campaignId,
      requesterUserId: userId,
      currency: (asset.symbol as "INR" | "USDT" | "USDC" | "ETH" | "MATIC") || "USDT",
      amount: dto.amountNative,
      amountNative: dto.amountNative,
      payoutRail: "CRYPTO",
      cryptoAddress: dto.toAddress,
      chainId: network.chainId,
      assetId: dto.assetId,
      networkId: dto.networkId,
      toAddress: dto.toAddress,
      invoiceNumber: `CRYPTO-${withdrawalId}`,
      invoiceDate: new Date().toISOString(),
      invoiceAmount: dto.amountNative,
      vendorName: "Crypto Withdrawal",
      proofFileUrl: dto.proofCids?.[0] || "",
      proofMimeType: "application/json",
      proofSha256: "",
      proofCids: dto.proofCids,
      status: "SUBMITTED",
    });

    return {
      withdrawalId,
      campaignId: dto.campaignId,
      assetId: dto.assetId,
      networkId: dto.networkId,
      amountNative: dto.amountNative,
      toAddress: dto.toAddress,
      proofCids: dto.proofCids,
      status: withdrawal.status,
      createdAt: (withdrawal.createdAt as admin.firestore.Timestamp).toDate().toISOString(),
    };
  }

  /**
   * Approve withdrawal (REVIEWER/ADMIN only)
   */
  async approveWithdrawal(withdrawalId: string, reviewerId: string, note?: string): Promise<void> {
    const withdrawal = await this.repo.getWithdrawal(withdrawalId);
    if (!withdrawal) {
      throw new NotFoundException("Withdrawal not found");
    }

    if (withdrawal.status !== "SUBMITTED") {
      throw new BadRequestException(`Withdrawal is ${withdrawal.status}, cannot approve`);
    }

    // Create approval record
    const approvalDocId = `${withdrawalId}_${reviewerId}`;
    await this.repo.createApproval(approvalDocId, {
      withdrawalId,
      reviewerId,
      decision: "APPROVE",
      note,
    });

    // Update withdrawal status
    await this.repo.updateWithdrawal(withdrawalId, {
      status: "APPROVED",
    });

    // TODO: Queue withdrawal execution job
    // await queue.add('withdrawal_executor', { withdrawalId });
  }

  /**
   * Reject withdrawal (REVIEWER/ADMIN only)
   */
  async rejectWithdrawal(withdrawalId: string, reviewerId: string, note?: string): Promise<void> {
    const withdrawal = await this.repo.getWithdrawal(withdrawalId);
    if (!withdrawal) {
      throw new NotFoundException("Withdrawal not found");
    }

    if (withdrawal.status !== "SUBMITTED") {
      throw new BadRequestException(`Withdrawal is ${withdrawal.status}, cannot reject`);
    }

    // Create rejection record
    const approvalDocId = `${withdrawalId}_${reviewerId}`;
    await this.repo.createApproval(approvalDocId, {
      withdrawalId,
      reviewerId,
      decision: "REJECT",
      note,
    });

    // Update withdrawal status
    await this.repo.updateWithdrawal(withdrawalId, {
      status: "REJECTED",
    });
  }

  /**
   * Get withdrawals for a campaign
   */
  async getWithdrawalsByCampaign(campaignId: string): Promise<WithdrawalResponse[]> {
    const withdrawals = await this.repo.getWithdrawalsByCampaign(campaignId);
    return withdrawals.map((w) => ({
      withdrawalId: w.withdrawalId,
      campaignId: w.campaignId,
      assetId: w.assetId,
      networkId: w.networkId,
      amountNative: w.amountNative,
      toAddress: w.toAddress,
      proofCids: w.proofCids,
      status: w.status,
      createdAt: (w.createdAt as admin.firestore.Timestamp).toDate().toISOString(),
      txHash: w.txHash,
      explorerUrl: w.explorerUrl,
    }));
  }

  /**
   * Get campaign finance data (admin endpoint)
   */
  async getCampaignFinance(campaignId: string) {
    const campaign = await this.repo.getCampaign(campaignId);
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    const stats = await this.repo.getCampaignStats(campaignId);
    const withdrawals = await this.repo.getWithdrawalsByCampaign(campaignId);

    // Get recent donations
    const deposits = await this.repo.getDepositsByCampaign(campaignId);
    const recentTxs: any[] = [];

    for (const deposit of deposits.slice(0, 10)) {
      const txs = await this.repo.getChainTxsByDeposit(deposit.id);
      recentTxs.push(...txs.slice(0, 5));
    }

    recentTxs.sort((a, b) => {
      const aTime = a.createdAt?.toMillis() || 0;
      const bTime = b.createdAt?.toMillis() || 0;
      return bTime - aTime;
    });

    return {
      campaignId,
      totalsUsd: stats?.totalsUsd || "0",
      totalsByAsset: stats?.totalsByAsset || {},
      balanceByAsset: stats?.balanceByAsset || {},
      recentDonations: recentTxs.slice(0, 50).map((tx) => ({
        txHash: tx.txHash,
        amountNative: tx.amountNative,
        assetId: tx.assetId,
        networkId: tx.networkId,
        explorerUrl: tx.explorerUrl,
        status: tx.status,
        confirmations: tx.confirmations,
        createdAt: tx.createdAt?.toDate().toISOString(),
      })),
      withdrawals: withdrawals.map((w) => ({
        withdrawalId: w.withdrawalId,
        assetId: w.assetId,
        networkId: w.networkId,
        amountNative: w.amountNative,
        toAddress: w.toAddress,
        status: w.status,
        proofCids: w.proofCids,
        txHash: w.txHash,
        explorerUrl: w.explorerUrl,
        createdAt: w.createdAt?.toDate().toISOString(),
      })),
    };
  }

  private generateWithdrawalId(): string {
    return createHash("sha256")
      .update(`${Date.now()}-${randomBytes(16).toString("hex")}`)
      .digest("hex")
      .substring(0, 32);
  }
}

