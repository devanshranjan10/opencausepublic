import { apiRequest } from "@/lib/api";

export interface KYCSubmitRequest {
  personalInfo: {
    fullName: string;
    dateOfBirth: string;
    nationality: string;
    email: string;
    phoneNumber: string;
    phoneCountryCode: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    documentType: "PASSPORT" | "DRIVER_LICENSE" | "NATIONAL_ID";
    governmentIdNumber: string;
    additionalNotes?: string;
  };
  documentFront?: string; // base64
  documentBack?: string; // base64
  proofOfAddress?: string; // base64
  faceData: {
    image: string; // base64
    quality: number;
    embedding?: number[];
    landmarks?: {
      leftEye: { x: number; y: number };
      rightEye: { x: number; y: number };
      nose: { x: number; y: number };
      mouth: { x: number; y: number };
    };
  };
  livenessData: Array<{
    action: string;
    images: string[]; // base64 array
    timestamp: number;
  }>;
  faceMatchScore?: number;
  overallScore?: number;
}

export interface KYCRecord {
  id: string;
  userId: string;
  personalInfo: any;
  documents: {
    idFront?: string | null; // R2 key (new) or base64 (old)
    idBack?: string | null; // R2 key (new) or base64 (old)
    proofOfAddress?: string | null; // R2 key (new) or base64 (old)
  };
  faceData: {
    imageKey?: string | null; // R2 key (new format)
    images?: string[]; // base64 array (old format, for backward compatibility)
    embeddings: string;
    qualityScore: number;
  };
  livenessData: {
    imageKeys?: string[]; // R2 keys array (new format)
    images?: string[]; // base64 array (old format, for backward compatibility)
    results: string; // JSON string with challenge metadata
    passed: boolean;
    score: number;
  };
  verification: {
    faceMatchScore: number;
    livenessPassed: boolean;
    overallScore: number;
  };
  status: "pending" | "approved" | "rejected" | "under_review";
  review?: {
    reviewedAt: any;
    reviewedBy: string;
    comments: string;
  };
  timestamps: {
    submittedAt: any;
    updatedAt: any;
  };
  r2BasePath: string;
}

/**
 * Submit KYC data to backend
 */
export async function submitKYC(data: KYCSubmitRequest): Promise<{ id: string; status: string }> {
  return apiRequest("/kyc/submit", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Get all KYC records
 */
export async function getAllKYCRecords(filters?: {
  status?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ records: KYCRecord[]; total: number; limit: number; offset: number }> {
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.userId) params.append("userId", filters.userId);
  if (filters?.limit) params.append("limit", filters.limit.toString());
  if (filters?.offset) params.append("offset", filters.offset.toString());

  const query = params.toString();
  return apiRequest(`/kyc/list${query ? `?${query}` : ""}`);
}

/**
 * Get specific KYC record
 */
export async function getKYCRecord(id: string): Promise<KYCRecord> {
  return apiRequest(`/kyc/${id}`);
}

/**
 * Update KYC status
 */
export async function updateKYCStatus(
  id: string,
  status: "pending" | "approved" | "rejected" | "under_review",
  comments?: string
): Promise<any> {
  return apiRequest(`/kyc/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, comments }),
  });
}

/**
 * Delete KYC record
 */
export async function deleteKYCRecord(id: string): Promise<void> {
  return apiRequest(`/kyc/${id}`, {
    method: "DELETE",
  });
}

/**
 * Get signed URL for document
 */
export async function getDocumentUrl(
  id: string,
  type: "idFront" | "idBack" | "proofOfAddress",
  expiresIn?: number
): Promise<{ url: string; key: string }> {
  const params = expiresIn ? `?expiresIn=${expiresIn}` : "";
  return apiRequest(`/kyc/${id}/document/${type}${params}`);
}

/**
 * Get signed URL for face image
 */
export async function getFaceImageUrl(
  id: string,
  index: number = 0,
  expiresIn?: number
): Promise<{ url: string; key: string }> {
  const params = expiresIn ? `?expiresIn=${expiresIn}` : "";
  return apiRequest(`/kyc/${id}/face/${index}${params}`);
}

/**
 * Get signed URL for liveness image
 */
export async function getLivenessImageUrl(
  id: string,
  challengeIndex: number,
  imageIndex: number,
  expiresIn?: number
): Promise<{ url: string; key: string }> {
  const params = expiresIn ? `?expiresIn=${expiresIn}` : "";
  return apiRequest(`/kyc/${id}/liveness/${challengeIndex}/${imageIndex}${params}`);
}

/**
 * Get KYC statistics
 */
export async function getKYCStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  underReview: number;
}> {
  return apiRequest("/kyc/stats/summary");
}

/**
 * Get user's KYC status
 */
export async function getKYCStatus(): Promise<{
  status: string;
  id?: string;
  submittedAt?: any;
}> {
  return apiRequest("/kyc/status");
}

/**
 * Alias for getKYCStatus for backward compatibility
 */
export const getMyKYCStatus = getKYCStatus;





