/**
 * Typed Firestore Repositories
 * 
 * Provides type-safe access to Firestore collections.
 */

import * as admin from "firebase-admin";
import {
  CryptoNetworkDoc,
  CryptoAssetDoc,
  CampaignDoc,
  CampaignDepositDoc,
  PaymentIntentDoc,
  ChainTxDoc,
  CampaignStatsDoc,
  WithdrawalDoc,
  WithdrawalApprovalDoc,
  KeyConfigDoc,
  CampaignPublicDoc,
  CampaignStatsPublicDoc,
  DonationPublicDoc,
  PaymentIntentPublicDoc,
  DonationPrivateDoc,
  PaymentIntentPrivateDoc,
  ChainTxPrivateDoc,
} from "./types";

export class FirestoreRepository {
  constructor(private firestore: admin.firestore.Firestore) {}

  // Generic helpers
  private collection(name: string) {
    return this.firestore.collection(name);
  }

  private serverTimestamp() {
    return admin.firestore.FieldValue.serverTimestamp();
  }

  // 1) Crypto Networks
  async createNetwork(networkId: string, data: CryptoNetworkDoc): Promise<CryptoNetworkDoc & { networkId: string }> {
    await this.collection("crypto_networks").doc(networkId).set({
      ...data,
      createdAt: this.serverTimestamp(),
      updatedAt: this.serverTimestamp(),
    });
    return { networkId, ...data };
  }

  async getNetwork(networkId: string): Promise<(CryptoNetworkDoc & { networkId: string }) | null> {
    const doc = await this.collection("crypto_networks").doc(networkId).get();
    return doc.exists ? { networkId: doc.id, ...doc.data() as CryptoNetworkDoc } : null;
  }

  async getEnabledNetworks(): Promise<(CryptoNetworkDoc & { networkId: string })[]> {
    const snapshot = await this.collection("crypto_networks")
      .where("enabled", "==", true)
      .get();
    return snapshot.docs.map((doc) => ({ networkId: doc.id, ...doc.data() as CryptoNetworkDoc }));
  }

  // 2) Crypto Assets
  async createAsset(assetId: string, data: CryptoAssetDoc): Promise<CryptoAssetDoc & { assetId: string }> {
    await this.collection("crypto_assets").doc(assetId).set({
      ...data,
      createdAt: this.serverTimestamp(),
      updatedAt: this.serverTimestamp(),
    });
    return { assetId, ...data };
  }

  async getAsset(assetId: string): Promise<(CryptoAssetDoc & { assetId: string }) | null> {
    const doc = await this.collection("crypto_assets").doc(assetId).get();
    return doc.exists ? { assetId: doc.id, ...doc.data() as CryptoAssetDoc } : null;
  }

  async getAssetsByNetwork(networkId: string): Promise<(CryptoAssetDoc & { assetId: string })[]> {
    const snapshot = await this.collection("crypto_assets")
      .where("networkId", "==", networkId)
      .where("enabled", "==", true)
      .get();
    return snapshot.docs.map((doc) => ({ assetId: doc.id, ...doc.data() as CryptoAssetDoc }));
  }

  async getEnabledAssets(): Promise<(CryptoAssetDoc & { assetId: string })[]> {
    const snapshot = await this.collection("crypto_assets")
      .where("enabled", "==", true)
      .get();
    return snapshot.docs.map((doc) => ({ assetId: doc.id, ...doc.data() as CryptoAssetDoc }));
  }

  // 3) Campaigns
  async getCampaign(campaignId: string): Promise<(CampaignDoc & { campaignId: string }) | null> {
    const doc = await this.collection("campaigns").doc(campaignId).get();
    return doc.exists ? { campaignId: doc.id, ...doc.data() as CampaignDoc } : null;
  }

  // 4) Campaign Deposits
  async createOrGetDeposit(
    docId: string,
    data: CampaignDepositDoc
  ): Promise<CampaignDepositDoc & { id: string }> {
    const docRef = this.collection("campaign_deposits").doc(docId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      await docRef.set({
        ...data,
        createdAt: this.serverTimestamp(),
      });
    }
    
    return { id: docId, ...(doc.exists ? doc.data() as CampaignDepositDoc : data) };
  }

  async getDeposit(docId: string): Promise<(CampaignDepositDoc & { id: string }) | null> {
    const doc = await this.collection("campaign_deposits").doc(docId).get();
    return doc.exists ? { id: doc.id, ...doc.data() as CampaignDepositDoc } : null;
  }

  async getDepositsByCampaign(campaignId: string): Promise<(CampaignDepositDoc & { id: string })[]> {
    const snapshot = await this.collection("campaign_deposits")
      .where("campaignId", "==", campaignId)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() as CampaignDepositDoc }));
  }

  // 5) Payment Intents
  async createPaymentIntent(intentId: string, data: PaymentIntentDoc): Promise<PaymentIntentDoc & { intentId: string }> {
    await this.collection("payment_intents").doc(intentId).set({
      ...data,
      createdAt: this.serverTimestamp(),
      updatedAt: this.serverTimestamp(),
    });
    return { intentId, ...data };
  }

  async getPaymentIntent(intentId: string): Promise<(PaymentIntentDoc & { intentId: string }) | null> {
    const doc = await this.collection("payment_intents").doc(intentId).get();
    return doc.exists ? { intentId: doc.id, ...doc.data() as PaymentIntentDoc } : null;
  }

  async updatePaymentIntent(intentId: string, data: Partial<PaymentIntentDoc>): Promise<void> {
    await this.collection("payment_intents").doc(intentId).update({
      ...data,
      updatedAt: this.serverTimestamp(),
    });
  }

  async getExpiredIntents(before: admin.firestore.Timestamp): Promise<(PaymentIntentDoc & { intentId: string })[]> {
    const snapshot = await this.collection("payment_intents")
      .where("expiresAt", "<", before)
      .where("status", "in", ["CREATED", "SEEN", "CONFIRMING"])
      .get();
    return snapshot.docs.map((doc) => ({ intentId: doc.id, ...doc.data() as PaymentIntentDoc }));
  }

  // 6) Chain Transactions
  async createOrUpdateChainTx(docId: string, data: ChainTxDoc): Promise<ChainTxDoc & { id: string }> {
    const docRef = this.collection("chain_txs").doc(docId);
    const doc = await docRef.get();
    
    if (doc.exists) {
      await docRef.update({
        ...data,
        updatedAt: this.serverTimestamp(),
      });
    } else {
      await docRef.set({
        ...data,
        createdAt: this.serverTimestamp(),
        updatedAt: this.serverTimestamp(),
      });
    }
    
    return { id: docId, ...data };
  }

  async getChainTx(docId: string): Promise<(ChainTxDoc & { id: string }) | null> {
    const doc = await this.collection("chain_txs").doc(docId).get();
    return doc.exists ? { id: doc.id, ...doc.data() as ChainTxDoc } : null;
  }

  async getChainTxsByDeposit(depositRef: string): Promise<(ChainTxDoc & { id: string })[]> {
    const snapshot = await this.collection("chain_txs")
      .where("depositRef", "==", depositRef)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() as ChainTxDoc }));
  }

  async getChainTxsByIntent(intentId: string): Promise<(ChainTxDoc & { id: string })[]> {
    const snapshot = await this.collection("chain_txs")
      .where("intentId", "==", intentId)
      .orderBy("createdAt", "desc")
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() as ChainTxDoc }));
  }

  // 7) Campaign Stats
  async getCampaignStats(campaignId: string): Promise<(CampaignStatsDoc & { campaignId: string }) | null> {
    const doc = await this.collection("campaign_stats").doc(campaignId).get();
    return doc.exists ? { campaignId: doc.id, ...doc.data() as CampaignStatsDoc } : null;
  }

  async updateCampaignStats(campaignId: string, data: Partial<CampaignStatsDoc>): Promise<void> {
    await this.collection("campaign_stats").doc(campaignId).set(
      {
        ...data,
        updatedAt: this.serverTimestamp(),
      },
      { merge: true }
    );
  }

  // 8) Withdrawals
  async createWithdrawal(withdrawalId: string, data: WithdrawalDoc): Promise<WithdrawalDoc & { withdrawalId: string }> {
    await this.collection("withdrawals").doc(withdrawalId).set({
      ...data,
      createdAt: this.serverTimestamp(),
      updatedAt: this.serverTimestamp(),
    });
    return { withdrawalId, ...data };
  }

  async getWithdrawal(withdrawalId: string): Promise<(WithdrawalDoc & { withdrawalId: string }) | null> {
    const doc = await this.collection("withdrawals").doc(withdrawalId).get();
    return doc.exists ? { withdrawalId: doc.id, ...doc.data() as WithdrawalDoc } : null;
  }

  async updateWithdrawal(withdrawalId: string, data: Partial<WithdrawalDoc>): Promise<void> {
    await this.collection("withdrawals").doc(withdrawalId).update({
      ...data,
      updatedAt: this.serverTimestamp(),
    });
  }

  async getWithdrawalsByCampaign(campaignId: string): Promise<(WithdrawalDoc & { withdrawalId: string })[]> {
    const snapshot = await this.collection("withdrawals")
      .where("campaignId", "==", campaignId)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    return snapshot.docs.map((doc) => ({ withdrawalId: doc.id, ...doc.data() as WithdrawalDoc }));
  }

  // 9) Withdrawal Approvals
  async createApproval(docId: string, data: WithdrawalApprovalDoc): Promise<WithdrawalApprovalDoc & { id: string }> {
    await this.collection("withdrawal_approvals").doc(docId).set({
      ...data,
      createdAt: this.serverTimestamp(),
    });
    return { id: docId, ...data };
  }

  async getApprovalsByWithdrawal(withdrawalId: string): Promise<(WithdrawalApprovalDoc & { id: string })[]> {
    const snapshot = await this.collection("withdrawal_approvals")
      .where("withdrawalId", "==", withdrawalId)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() as WithdrawalApprovalDoc }));
  }

  // 10) Key Configs
  async getKeyConfig(keyId: string): Promise<(KeyConfigDoc & { keyId: string }) | null> {
    const doc = await this.collection("key_configs").doc(keyId).get();
    return doc.exists ? { keyId: doc.id, ...doc.data() as KeyConfigDoc } : null;
  }

  async updateKeyConfig(keyId: string, data: Partial<KeyConfigDoc>): Promise<void> {
    await this.collection("key_configs").doc(keyId).set(
      {
        ...data,
        updatedAt: this.serverTimestamp(),
      },
      { merge: true }
    );
  }

  // ============================================
  // PUBLIC COLLECTIONS (client-readable)
  // ============================================

  // Campaigns Public
  async createOrUpdateCampaignPublic(campaignId: string, data: CampaignPublicDoc): Promise<void> {
    await this.collection("campaigns_public").doc(campaignId).set({
      ...data,
      campaignId,
      updatedAt: this.serverTimestamp(),
    }, { merge: true });
  }

  async getCampaignPublic(campaignId: string): Promise<CampaignPublicDoc | null> {
    const doc = await this.collection("campaigns_public").doc(campaignId).get();
    return doc.exists ? (doc.data() as CampaignPublicDoc) : null;
  }

  // Campaign Stats Public
  async createOrUpdateCampaignStatsPublic(campaignId: string, data: CampaignStatsPublicDoc): Promise<void> {
    await this.collection("campaign_stats_public").doc(campaignId).set({
      ...data,
      campaignId,
      updatedAt: this.serverTimestamp(),
    }, { merge: true });
  }

  async getCampaignStatsPublic(campaignId: string): Promise<CampaignStatsPublicDoc | null> {
    const doc = await this.collection("campaign_stats_public").doc(campaignId).get();
    return doc.exists ? (doc.data() as CampaignStatsPublicDoc) : null;
  }

  // Donations Public
  async createDonationPublic(campaignId: string, donationId: string, data: DonationPublicDoc): Promise<void> {
    await this.collection("donations_public").doc(campaignId)
      .collection("items").doc(donationId).set({
        ...data,
        campaignId,
        donationId,
        createdAt: this.serverTimestamp(),
      });
  }

  async getDonationsPublic(campaignId: string, limit: number = 100): Promise<DonationPublicDoc[]> {
    const snapshot = await this.collection("donations_public").doc(campaignId)
      .collection("items")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => doc.data() as DonationPublicDoc);
  }

  // Payment Intents Public
  async createOrUpdatePaymentIntentPublic(intentId: string, data: PaymentIntentPublicDoc): Promise<void> {
    await this.collection("payment_intents_public").doc(intentId).set({
      ...data,
      intentId,
      updatedAt: this.serverTimestamp(),
    }, { merge: true });
  }

  async getPaymentIntentPublic(intentId: string): Promise<PaymentIntentPublicDoc | null> {
    const doc = await this.collection("payment_intents_public").doc(intentId).get();
    return doc.exists ? (doc.data() as PaymentIntentPublicDoc) : null;
  }

  // ============================================
  // PRIVATE COLLECTIONS (server-only)
  // ============================================

  // Donations Private
  async createDonationPrivate(donationId: string, data: DonationPrivateDoc): Promise<void> {
    await this.collection("donations_private").doc(donationId).set({
      ...data,
      donationId,
      createdAt: this.serverTimestamp(),
    });
  }

  async getDonationPrivate(donationId: string): Promise<DonationPrivateDoc | null> {
    const doc = await this.collection("donations_private").doc(donationId).get();
    return doc.exists ? (doc.data() as DonationPrivateDoc) : null;
  }

  // Payment Intents Private
  async createPaymentIntentPrivate(intentId: string, data: PaymentIntentPrivateDoc): Promise<void> {
    await this.collection("payment_intents_private").doc(intentId).set({
      ...data,
      intentId,
      createdAt: this.serverTimestamp(),
      updatedAt: this.serverTimestamp(),
    });
  }

  async getPaymentIntentPrivate(intentId: string): Promise<PaymentIntentPrivateDoc | null> {
    const doc = await this.collection("payment_intents_private").doc(intentId).get();
    return doc.exists ? (doc.data() as PaymentIntentPrivateDoc) : null;
  }

  async updatePaymentIntentPrivate(intentId: string, data: Partial<PaymentIntentPrivateDoc>): Promise<void> {
    await this.collection("payment_intents_private").doc(intentId).update({
      ...data,
      updatedAt: this.serverTimestamp(),
    });
  }

  // Chain Transactions Private
  async createOrUpdateChainTxPrivate(docId: string, data: ChainTxPrivateDoc): Promise<void> {
    const docRef = this.collection("chain_txs_private").doc(docId);
    const existing = await docRef.get();
    
    if (existing.exists) {
      await docRef.update({
        ...data,
        updatedAt: this.serverTimestamp(),
      });
    } else {
      await docRef.set({
        ...data,
        createdAt: this.serverTimestamp(),
        updatedAt: this.serverTimestamp(),
      });
    }
  }

  async getChainTxPrivate(docId: string): Promise<ChainTxPrivateDoc | null> {
    const doc = await this.collection("chain_txs_private").doc(docId).get();
    return doc.exists ? (doc.data() as ChainTxPrivateDoc) : null;
  }
}

