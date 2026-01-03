import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";
import * as admin from "firebase-admin";
import { createHash } from "crypto";
import {
  uploadBuffer,
  buildProofKey,
  getExtensionFromMimeType,
  getSignedGetUrl,
  getPublicUrl,
} from "@opencause/r2";

export interface ProofMetadata {
  proofId: string;
  campaignId: string;
  withdrawalId: string;
  objectKey: string;
  sha256: string;
  mimeType: string;
  size: number;
  isPublic: boolean;
  createdByUid?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

export interface ProofAccessLog {
  proofId: string;
  uid: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: admin.firestore.Timestamp;
}

@Injectable()
export class ProofsService {
  /**
   * Get Firestore instance lazily (after Firebase is initialized)
   */
  private get db(): admin.firestore.Firestore {
    if (!admin.apps.length) {
      throw new Error("Firebase Admin not initialized. Please check your Firebase configuration.");
    }
    return admin.firestore();
  }

  /**
   * Upload proof file to R2 and create metadata in Firestore
   * Deduplicates by SHA-256
   */
  async uploadProof(params: {
    campaignId: string;
    withdrawalId: string;
    buffer: Buffer;
    mimeType: string;
    filename: string;
    createdByUid?: string;
  }): Promise<{ proofId: string; objectKey: string; url: string | null; isPublic: boolean }> {
    const { campaignId, withdrawalId, buffer, mimeType, filename, createdByUid } = params;

    // Compute SHA-256 hash
    const sha256 = createHash("sha256").update(buffer).digest("hex");

    // Check for existing proof with same withdrawalId and sha256
    const existingProof = await this.findExistingProof(withdrawalId, sha256);
    if (existingProof) {
      // Return existing proof
      const url = existingProof.isPublic ? getPublicUrl(existingProof.objectKey) : null;
      return {
        proofId: existingProof.proofId,
        objectKey: existingProof.objectKey,
        url,
        isPublic: existingProof.isPublic,
      };
    }

    // Get extension from mimetype
    const ext = getExtensionFromMimeType(mimeType);

    // Build object key
    const objectKey = buildProofKey({ campaignId, withdrawalId, sha256, ext });

    // Upload to R2
    await uploadBuffer({
      key: objectKey,
      buffer,
      contentType: mimeType,
    });

    // Create Firestore metadata document
    const proofId = this.db.collection("withdrawal_proofs").doc().id;
    const now = admin.firestore.Timestamp.now();
    
    const proofData: Omit<ProofMetadata, "proofId"> = {
      campaignId,
      withdrawalId,
      objectKey,
      sha256,
      mimeType,
      size: buffer.length,
      isPublic: false, // Default to private
      createdByUid,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.collection("withdrawal_proofs").doc(proofId).set(proofData);

    return {
      proofId,
      objectKey,
      url: null, // Private by default, use signed URL endpoint
      isPublic: false,
    };
  }

  /**
   * Find existing proof by withdrawalId and sha256
   */
  private async findExistingProof(
    withdrawalId: string,
    sha256: string
  ): Promise<ProofMetadata | null> {
    const snapshot = await this.db
      .collection("withdrawal_proofs")
      .where("withdrawalId", "==", withdrawalId)
      .where("sha256", "==", sha256)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      proofId: doc.id,
      ...doc.data(),
    } as ProofMetadata;
  }

  /**
   * Get proof metadata by ID
   */
  async getProofById(proofId: string): Promise<ProofMetadata> {
    const doc = await this.db.collection("withdrawal_proofs").doc(proofId).get();
    
    if (!doc.exists) {
      throw new NotFoundException(`Proof ${proofId} not found`);
    }

    return {
      proofId: doc.id,
      ...doc.data(),
    } as ProofMetadata;
  }

  /**
   * Get URL for proof (public or signed)
   * Logs access for audit
   */
  async getProofUrl(
    proofId: string,
    options: {
      uid?: string | null;
      ip?: string | null;
      userAgent?: string | null;
      checkAccess?: (proof: ProofMetadata) => boolean;
    } = {}
  ): Promise<string> {
    const { uid, ip, userAgent, checkAccess } = options;

    const proof = await this.getProofById(proofId);

    // Check access if provided
    if (checkAccess && !checkAccess(proof)) {
      throw new ForbiddenException("Access denied to this proof");
    }

    // Log access
    await this.logProofAccess({ proofId, uid: uid || null, ip: ip || null, userAgent: userAgent || null });

    // If public and public URL configured, return permanent URL
    if (proof.isPublic) {
      const publicUrl = getPublicUrl(proof.objectKey);
      if (publicUrl) {
        return publicUrl;
      }
    }

    // Return signed URL (5 minutes)
    return await getSignedGetUrl(proof.objectKey, 300);
  }

  /**
   * Log proof access for audit
   */
  private async logProofAccess(log: {
    proofId: string;
    uid: string | null;
    ip: string | null;
    userAgent: string | null;
  }): Promise<void> {
    await this.db.collection("proof_access_logs").add({
      ...log,
      createdAt: admin.firestore.Timestamp.now(),
    });
  }

  /**
   * List proofs for a withdrawal
   */
  async listProofsByWithdrawalId(withdrawalId: string): Promise<ProofMetadata[]> {
    const snapshot = await this.db
      .collection("withdrawal_proofs")
      .where("withdrawalId", "==", withdrawalId)
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((doc) => ({
      proofId: doc.id,
      ...doc.data(),
    })) as ProofMetadata[];
  }

  /**
   * List public proofs for a campaign
   */
  async listPublicProofsByCampaignId(campaignId: string): Promise<ProofMetadata[]> {
    const snapshot = await this.db
      .collection("withdrawal_proofs")
      .where("campaignId", "==", campaignId)
      .where("isPublic", "==", true)
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((doc) => ({
      proofId: doc.id,
      ...doc.data(),
    })) as ProofMetadata[];
  }
}

