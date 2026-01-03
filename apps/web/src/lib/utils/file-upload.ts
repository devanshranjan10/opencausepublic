import { createHash } from "crypto";

/**
 * File upload utilities
 */

export interface UploadedFile {
  url: string;
  mimeType: string;
  sha256: string;
  size: number;
}

/**
 * Validate file before upload
 */
export function validateFile(
  file: File,
  maxSize: number = 10 * 1024 * 1024, // 10MB default
  allowedTypes: string[] = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]
): { valid: boolean; error?: string } {
  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${allowedTypes.join(", ")}`,
    };
  }

  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${(maxSize / 1024 / 1024).toFixed(1)}MB`,
    };
  }

  return { valid: true };
}

/**
 * Compute SHA256 hash of file (client-side)
 */
export async function computeFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Convert file to base64 data URL
 * Useful for preview or direct upload to server
 */
export async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert file to base64 string (without data URL prefix)
 */
export async function fileToBase64(file: File): Promise<string> {
  const dataURL = await fileToDataURL(file);
  // Remove "data:mime/type;base64," prefix
  return dataURL.split(",")[1];
}

/**
 * Upload file to server (multipart/form-data)
 */
export async function uploadFileToServer(
  file: File,
  uploadEndpoint: string,
  additionalData?: Record<string, string>
): Promise<UploadedFile> {
  // Validate file first
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Compute hash
  const sha256 = await computeFileHash(file);

  // Create form data
  const formData = new FormData();
  formData.append("file", file);
  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, value);
    });
  }

  // Upload to server
  const response = await fetch(uploadEndpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Upload failed" }));
    throw new Error(error.message || "File upload failed");
  }

  const result = await response.json();

  return {
    url: result.url || result.fileUrl,
    mimeType: file.type,
    sha256,
    size: file.size,
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

