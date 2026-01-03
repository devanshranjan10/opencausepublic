import { Injectable, BadRequestException } from "@nestjs/common";
import { FirebaseService } from "../firebase/firebase.service";
import { KYCDto, VC } from "@opencause/types";
import * as jwt from "jsonwebtoken";
import * as admin from "firebase-admin";
import { uploadBuffer, buildKYCImageKey, getExtensionFromMimeType, getSignedGetUrl } from "@opencause/r2";

@Injectable()
export class KYCService {
  private issuerPrivateKey = process.env.VC_ISSUER_PRIVATE_KEY || "mock-private-key";

  constructor(private firebase: FirebaseService) {}

  /**
   * Mock VC issuer - generates a JWT VC
   * In production, use proper VC libraries
   */
  async issueVC(userId: string, kycData: KYCDto): Promise<string> {
    const user = await this.firebase.getUserById(userId) as any;
    if (!user) {
      throw new BadRequestException("User not found");
    }

    // Create VC payload
    const vcPayload = {
      "@context": ["https://www.w3.org/2018/credentials/v1"],
      type: ["VerifiableCredential", "KYCVerification"],
      credentialSubject: {
        id: user.did,
        kycVerified: true,
        role: user.role,
        ...(user.role === "NGO_ORGANIZER" && {
          registrationNumber: kycData.registrationNumber,
          section12A: kycData.section12A,
          section80G: kycData.section80G,
          fcraRegistered: kycData.fcraRegistered,
        }),
      },
      issuer: "did:key:z6Mkopencauseissuer",
      issuanceDate: new Date().toISOString(),
    };

    // Sign as JWT VC
    const vcJwt = jwt.sign(vcPayload, this.issuerPrivateKey, {
      algorithm: "HS256",
      expiresIn: "1y",
    });

    // Store VC and update KYC status
    await this.firebase.updateUser(userId, {
      vcJwt,
      kycStatus: "VERIFIED",
    });

    return vcJwt;
  }

  /**
   * Verify VC signature
   */
  async verifyVC(vcJwt: string): Promise<VC | null> {
    try {
      const decoded = jwt.verify(vcJwt, this.issuerPrivateKey) as any;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Submit KYC data and get VC
   */
  async submitKYC(userId: string, kycData: KYCDto): Promise<string> {
    const user = await this.firebase.getUserById(userId) as any;
    if (!user) {
      throw new BadRequestException("User not found");
    }

    const userType = user.role === "NGO_ORGANIZER" ? "NGO" : "INDIVIDUAL";
    
    // Create or update KYC profile
    const kycProfileRef = this.firebase.firestore.collection("kyc_profiles").doc(userId);
    await kycProfileRef.set({
      uid: userId,
      status: "PENDING",
      type: userType,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Issue VC (mock for now)
    const vcJwt = await this.issueVC(userId, kycData);
    
    // Update KYC profile to VERIFIED after VC issuance
    await kycProfileRef.update({
      status: "VERIFIED",
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return vcJwt;
  }

  /**
   * Get KYC profile status
   */
  async getKYCStatus(userId: string): Promise<{ status: string; type?: string; verifiedAt?: any } | null> {
    const kycProfileRef = this.firebase.firestore.collection("kyc_profiles").doc(userId);
    const kycProfile = await kycProfileRef.get();
    
    if (!kycProfile.exists) {
      return { status: "NOT_STARTED" };
    }
    
    return kycProfile.data() as any;
  }

  /**
   * Submit KYC data with full form data (from new KYC flow)
   */
  async submitKYCData(userId: string, data: any, initialStatus?: string): Promise<{ id: string; status: string }> {
    try {
      const user = await this.firebase.getUserById(userId) as any;
      if (!user) {
        throw new BadRequestException("User not found");
      }

      const userType = user.role === "NGO_ORGANIZER" ? "NGO" : "INDIVIDUAL";
      
      // Generate record ID
      const recordId = this.firebase.firestore.collection("kyc_records").doc().id;
      
      // Helper function to convert base64 to buffer
      const base64ToBuffer = (base64: string): Buffer => {
        // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
        const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
        return Buffer.from(base64Data, "base64");
      };

      // Helper function to extract mime type from base64 data URL
      const getMimeTypeFromBase64 = (base64: string): string => {
        if (base64.startsWith("data:")) {
          const match = base64.match(/data:([^;]+);base64/);
          return match ? match[1] : "image/jpeg";
        }
        return "image/jpeg"; // Default
      };

      // Upload document images to R2
      const documentKeys: any = {};
      if (data.documentFront && data.documentFront.trim() !== "") {
        const mimeType = getMimeTypeFromBase64(data.documentFront);
        const ext = getExtensionFromMimeType(mimeType);
        const key = buildKYCImageKey({ userId, recordId, type: "document", ext, index: 0 });
        const buffer = base64ToBuffer(data.documentFront);
        await uploadBuffer({ key, buffer, contentType: mimeType });
        documentKeys.idFront = key;
      }
      if (data.documentBack && data.documentBack.trim() !== "") {
        const mimeType = getMimeTypeFromBase64(data.documentBack);
        const ext = getExtensionFromMimeType(mimeType);
        const key = buildKYCImageKey({ userId, recordId, type: "document", ext, index: 1 });
        const buffer = base64ToBuffer(data.documentBack);
        await uploadBuffer({ key, buffer, contentType: mimeType });
        documentKeys.idBack = key;
      }
      if (data.proofOfAddress && data.proofOfAddress.trim() !== "") {
        const mimeType = getMimeTypeFromBase64(data.proofOfAddress);
        const ext = getExtensionFromMimeType(mimeType);
        const key = buildKYCImageKey({ userId, recordId, type: "document", ext, index: 2 });
        const buffer = base64ToBuffer(data.proofOfAddress);
        await uploadBuffer({ key, buffer, contentType: mimeType });
        documentKeys.proofOfAddress = key;
      }

      // Upload face image to R2
      let faceImageKey: string | null = null;
      if (data.faceData?.image && data.faceData.image.trim() !== "") {
        const mimeType = getMimeTypeFromBase64(data.faceData.image);
        const ext = getExtensionFromMimeType(mimeType);
        const key = buildKYCImageKey({ userId, recordId, type: "face", ext });
        const buffer = base64ToBuffer(data.faceData.image);
        await uploadBuffer({ key, buffer, contentType: mimeType });
        faceImageKey = key;
      }

      // Upload liveness images to R2 and create metadata without base64
      const livenessKeys: string[] = [];
      const livenessResults = data.livenessData && Array.isArray(data.livenessData)
        ? data.livenessData
        : [];
      
      // Create liveness metadata without base64 images (only store metadata)
      const livenessMetadata: any[] = [];
      
      for (let challengeIndex = 0; challengeIndex < livenessResults.length; challengeIndex++) {
        const challenge = livenessResults[challengeIndex];
        if (challenge.images && Array.isArray(challenge.images)) {
          const challengeImageKeys: string[] = [];
          for (let imageIndex = 0; imageIndex < challenge.images.length; imageIndex++) {
            const imageBase64 = challenge.images[imageIndex];
            if (imageBase64 && imageBase64.trim() !== "") {
              const mimeType = getMimeTypeFromBase64(imageBase64);
              const ext = getExtensionFromMimeType(mimeType);
              const key = buildKYCImageKey({ userId, recordId, type: "liveness", ext, index: challengeIndex * 100 + imageIndex });
              const buffer = base64ToBuffer(imageBase64);
              await uploadBuffer({ key, buffer, contentType: mimeType });
              livenessKeys.push(key);
              challengeImageKeys.push(key);
            }
          }
          // Store metadata without base64 images
          livenessMetadata.push({
            action: challenge.action,
            imageKeys: challengeImageKeys,
            timestamp: challenge.timestamp,
            completed: challenge.completed,
          });
        }
      }
      
      // Store metadata in Firestore (no base64 images, no large OCR data, minimal embeddings)
      const kycRecordRef = this.firebase.firestore.collection("kyc_records").doc(recordId);
      
      // Only store essential face data (embeddings and landmarks can be large, so truncate or omit if too big)
      let faceEmbeddings = "";
      if (data.faceData?.embedding) {
        const embeddingStr = JSON.stringify(data.faceData.embedding);
        // Limit embeddings to 5KB to avoid Firestore size issues
        if (embeddingStr.length > 5000) {
          console.warn(`[KYC] Face embedding too large (${embeddingStr.length} bytes), omitting`);
          faceEmbeddings = ""; // Don't store if too large
        } else {
          faceEmbeddings = embeddingStr;
        }
      }
      
      // Don't store landmarks - they can be very large
      // If needed, they can be stored in R2 separately
      
      // Prepare Firestore document (ensure no large data)
      const firestoreDoc: any = {
        id: recordId,
        userId,
        personalInfo: data.personalInfo || {},
        documents: {
          idFront: documentKeys.idFront || null,
          idBack: documentKeys.idBack || null,
          proofOfAddress: documentKeys.proofOfAddress || null,
          // Don't store OCR data in Firestore - it can be large (store in R2 if needed later)
          // OCR data: documentFrontOcr, documentBackOcr, proofOfAddressOcr are not stored
        },
        faceData: {
          imageKey: faceImageKey,
          embeddings: faceEmbeddings, // Only if small enough, otherwise empty
          qualityScore: data.faceData?.quality || 0,
          // Don't store landmarks - too large
        },
        livenessData: {
          imageKeys: livenessKeys,
          results: JSON.stringify(livenessMetadata), // No base64 images in metadata
          passed: livenessResults.length > 0 ? livenessResults.every((l: any) => l.completed !== false) : false,
          score: data.overallScore || 0,
        },
        verification: {
          faceMatchScore: data.faceMatchScore || 0,
          livenessPassed: livenessResults.length > 0 ? livenessResults.every((l: any) => l.completed !== false) : false,
          overallScore: data.overallScore || 0,
        },
        status: "pending",
        timestamps: {
          submittedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        r2BasePath: `kyc/${userId}/${recordId}`,
      };

      // Estimate document size (rough estimate in bytes)
      const docSizeEstimate = JSON.stringify(firestoreDoc).length;
      if (docSizeEstimate > 900000) { // Leave some margin below 1MB limit
        console.error(`[KYC] Firestore document too large: ${docSizeEstimate} bytes`);
        // Remove embeddings if document is still too large
        if (firestoreDoc.faceData.embeddings) {
          firestoreDoc.faceData.embeddings = "";
          const newSize = JSON.stringify(firestoreDoc).length;
          console.warn(`[KYC] Removed embeddings, new size: ${newSize} bytes`);
        }
      }

      await kycRecordRef.set(firestoreDoc);

    // Determine status based on initialStatus parameter or face match score
    let finalStatus = initialStatus?.toLowerCase() || "pending";
    
    // If initialStatus is VERIFIED or face match score is high enough, auto-approve
    if (initialStatus === "VERIFIED" || (data.faceMatchScore && data.faceMatchScore >= 0.55 && data.overallScore && data.overallScore >= 0.7)) {
      finalStatus = "approved";
      // Auto-verify if score is high enough
      try {
        await this.issueVC(userId, data as any);
      } catch (err) {
        console.error("Failed to issue VC:", err);
        // Continue with approval even if VC issuance fails
      }
    }

    // Update KYC profile
    const kycProfileRef = this.firebase.firestore.collection("kyc_profiles").doc(userId);
    await kycProfileRef.set({
      uid: userId,
      status: finalStatus === "approved" ? "VERIFIED" : "PENDING",
      type: userType,
      recordId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Update user's kycStatus
    if (finalStatus === "approved") {
      await this.firebase.updateUser(userId, {
        kycStatus: "VERIFIED",
      });
    }

      // Update record status
      await kycRecordRef.update({
        status: finalStatus,
        "timestamps.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
      });

      return { id: recordId, status: finalStatus };
    } catch (error: any) {
      console.error("[KYC Service] Error submitting KYC data:", error);
      console.error("[KYC Service] Error details:", {
        message: error.message,
        stack: error.stack,
        userId,
        hasPersonalInfo: !!data.personalInfo,
        hasDocumentFront: !!data.documentFront,
        hasFaceData: !!data.faceData,
        livenessDataLength: data.livenessData?.length || 0,
      });
      throw new BadRequestException(
        error.message || "Failed to submit KYC data. Please try again."
      );
    }
  }

  /**
   * Get all KYC records (admin)
   */
  async getAllKYCRecords(filters: {
    status?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ records: any[]; total: number; limit: number; offset: number }> {
    let query: admin.firestore.Query = this.firebase.firestore.collection("kyc_records");
    
    if (filters.status && filters.status !== "ALL") {
      query = query.where("status", "==", filters.status);
    }
    if (filters.userId) {
      query = query.where("userId", "==", filters.userId);
    }
    
    query = query.orderBy("timestamps.submittedAt", "desc");
    
    const totalSnapshot = await query.get();
    const total = totalSnapshot.size;
    
    if (filters.offset) {
      query = query.offset(filters.offset);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    
    const snapshot = await query.get();
    const records = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      records,
      total,
      limit: filters.limit || 100,
      offset: filters.offset || 0,
    };
  }

  /**
   * Get KYC stats (admin)
   */
  async getKYCStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    underReview: number;
  }> {
    const allRecords = await this.firebase.firestore.collection("kyc_records").get();
    const records = allRecords.docs.map((doc) => doc.data());
    
    return {
      total: records.length,
      pending: records.filter((r) => r.status === "pending").length,
      approved: records.filter((r) => r.status === "approved").length,
      rejected: records.filter((r) => r.status === "rejected").length,
      underReview: records.filter((r) => r.status === "under_review").length,
    };
  }

  /**
   * Get specific KYC record
   */
  async getKYCRecord(id: string): Promise<any> {
    const recordRef = this.firebase.firestore.collection("kyc_records").doc(id);
    const record = await recordRef.get();
    
    if (!record.exists) {
      throw new BadRequestException("KYC record not found");
    }
    
    return {
      id: record.id,
      ...record.data(),
    };
  }

  /**
   * Update KYC status
   */
  async updateKYCStatus(id: string, status: string, comments?: string): Promise<any> {
    const recordRef = this.firebase.firestore.collection("kyc_records").doc(id);
    const record = await recordRef.get();
    
    if (!record.exists) {
      throw new BadRequestException("KYC record not found");
    }
    
    const updateData: any = {
      status,
      "timestamps.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
    };
    
    if (comments) {
      updateData.review = {
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        comments,
      };
    }
    
    await recordRef.update(updateData);
    
    // Update user's KYC profile status
    const recordData = record.data();
    if (recordData?.userId) {
      const profileRef = this.firebase.firestore.collection("kyc_profiles").doc(recordData.userId);
      await profileRef.update({
        status: status === "approved" ? "VERIFIED" : status.toUpperCase(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      // Update user's kycStatus
      if (status === "approved") {
        await this.firebase.updateUser(recordData.userId, {
          kycStatus: "VERIFIED",
        });
      }
    }
    
    return { id, status };
  }

  /**
   * Delete KYC record
   */
  async deleteKYCRecord(id: string): Promise<void> {
    const recordRef = this.firebase.firestore.collection("kyc_records").doc(id);
    await recordRef.delete();
  }

  /**
   * Get signed URL for document from R2
   */
  async getDocumentUrl(id: string, type: "idFront" | "idBack" | "proofOfAddress", expiresIn?: number): Promise<{ url: string; key: string }> {
    const record = await this.getKYCRecord(id);
    const r2Key = record.documents?.[type === "idFront" ? "idFront" : type === "idBack" ? "idBack" : "proofOfAddress"];
    
    if (!r2Key) {
      throw new BadRequestException("Document not found");
    }
    
    const signedUrl = await getSignedGetUrl(r2Key, expiresIn || 3600); // Default 1 hour
    return { url: signedUrl, key: r2Key };
  }

  /**
   * Get signed URL for face image from R2
   */
  async getFaceImageUrl(id: string, index: number = 0, expiresIn?: number): Promise<{ url: string; key: string }> {
    const record = await this.getKYCRecord(id);
    const r2Key = record.faceData?.imageKey;
    
    if (!r2Key) {
      throw new BadRequestException("Face image not found");
    }
    
    const signedUrl = await getSignedGetUrl(r2Key, expiresIn || 3600); // Default 1 hour
    return { url: signedUrl, key: r2Key };
  }

  /**
   * Get signed URL for liveness image from R2
   */
  async getLivenessImageUrl(id: string, challengeIndex: number, imageIndex: number, expiresIn?: number): Promise<{ url: string; key: string }> {
    const record = await this.getKYCRecord(id);
    const livenessKeys = record.livenessData?.imageKeys;
    
    if (!livenessKeys || !Array.isArray(livenessKeys)) {
      throw new BadRequestException("Liveness images not found or invalid format");
    }
    
    // Calculate index: challenges are stored sequentially
    const livenessData = record.livenessData?.results ? JSON.parse(record.livenessData.results) : [];
    let imageOffset = 0;
    
    // Calculate offset by summing imageKeys from previous challenges
    for (let i = 0; i < challengeIndex && i < livenessData.length; i++) {
      const challenge = livenessData[i];
      // New format: use imageKeys, fallback to images for old format
      if (challenge.imageKeys && Array.isArray(challenge.imageKeys)) {
        imageOffset += challenge.imageKeys.length;
      } else if (challenge.images && Array.isArray(challenge.images)) {
        imageOffset += challenge.images.length;
      }
    }
    
    const finalIndex = imageOffset + imageIndex;
    if (finalIndex >= livenessKeys.length) {
      throw new BadRequestException(`Liveness image not found at specified index (challengeIndex: ${challengeIndex}, imageIndex: ${imageIndex}, finalIndex: ${finalIndex}, totalKeys: ${livenessKeys.length})`);
    }
    
    const r2Key = livenessKeys[finalIndex];
    if (!r2Key) {
      throw new BadRequestException(`Liveness image key not found at index ${finalIndex}`);
    }
    
    const signedUrl = await getSignedGetUrl(r2Key, expiresIn || 3600); // Default 1 hour
    return { url: signedUrl, key: r2Key };
  }
}

