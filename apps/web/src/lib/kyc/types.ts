import { DocumentType, KYCStatus } from "./config";

export type { DocumentType, KYCStatus };

export interface KYCFormData {
  // Personal Information
  fullName: string;
  dateOfBirth: string; // ISO date string
  nationality: string;
  email: string;
  phoneNumber: string;
  phoneCountryCode: string;
  
  // Address
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  
  // ID Information
  documentType: DocumentType;
  governmentIdNumber: string;
  
  // Document Uploads (base64 encoded)
  documentFront?: string;
  documentBack?: string;
  proofOfAddress?: string;
  additionalNotes?: string;
  
  // OCR Data from document validation
  documentFrontOcr?: {
    extractedText: string;
    matchedKeywords: string[];
  };
  documentBackOcr?: {
    extractedText: string;
    matchedKeywords: string[];
  };
  proofOfAddressOcr?: {
    extractedText: string;
    matchedKeywords: string[];
  };
}

export interface FaceData {
  image: string; // base64 encoded
  embedding?: number[]; // face descriptor/embedding
  quality: number; // 0-1 quality score
  landmarks?: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    nose: { x: number; y: number };
    mouth: { x: number; y: number };
  };
}

export interface LivenessData {
  action: string;
  images: string[]; // base64 encoded images from the challenge
  completed: boolean;
  timestamp: number;
}

export interface KYCRecord {
  recordId: string; // UUID
  userId: string;
  timestamp: number;
  formData: KYCFormData;
  faceImage: FaceData;
  livenessImages: LivenessData[];
  faceMatchScore?: number;
  status: KYCStatus;
  blockchainHash?: string;
  blockchainTxId?: string;
  reviewerNotes?: string;
  reviewedAt?: number;
  reviewedBy?: string;
}

export interface FaceDetectionResult {
  detected: boolean;
  confidence: number;
  box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks?: {
    leftEye: { x: number; y: number };
    rightEye: { x: number; y: number };
    nose: { x: number; y: number };
    mouth: { x: number; y: number };
  };
}

export interface FaceMatchResult {
  matched: boolean;
  score: number; // 0-1 similarity score
  threshold: number;
}

