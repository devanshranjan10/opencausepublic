/**
 * Build R2 object key for proof files
 * Format: proofs/{campaignId}/{withdrawalId}/{sha256}.{ext}
 */
export interface ProofKeyParams {
  campaignId: string;
  withdrawalId: string;
  sha256: string;
  ext: string;
}

export function buildProofKey(params: ProofKeyParams): string {
  const { campaignId, withdrawalId, sha256, ext } = params;
  return `proofs/${campaignId}/${withdrawalId}/${sha256}.${ext}`;
}

/**
 * Extract extension from mimetype
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };

  return map[mimeType.toLowerCase()] || "bin";
}

/**
 * Build R2 object key for KYC images
 * Format: kyc/{userId}/{recordId}/{type}/{index}.{ext}
 */
export interface KYCImageKeyParams {
  userId: string;
  recordId: string;
  type: "document" | "face" | "liveness";
  index?: number;
  ext: string;
}

export function buildKYCImageKey(params: KYCImageKeyParams): string {
  const { userId, recordId, type, index, ext } = params;
  if (index !== undefined) {
    return `kyc/${userId}/${recordId}/${type}/${index}.${ext}`;
  }
  return `kyc/${userId}/${recordId}/${type}.${ext}`;
}

