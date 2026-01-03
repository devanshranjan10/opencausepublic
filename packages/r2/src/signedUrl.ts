import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "./r2Client";

/**
 * Get a signed URL for reading an object from R2
 * @param key Object key in R2
 * @param expiresInSeconds Expiration time in seconds (default: 300 = 5 minutes)
 */
export async function getSignedGetUrl(
  key: string,
  expiresInSeconds: number = 300
): Promise<string> {
  const bucket = process.env.R2_BUCKET || "opencause-proofs";

  if (!bucket) {
    throw new Error("R2_BUCKET environment variable is required");
  }

  const client = getR2Client();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Get public URL if R2_PUBLIC_BASE_URL is configured
 */
export function getPublicUrl(key: string): string | null {
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (!publicBaseUrl) {
    return null;
  }

  // Ensure base URL doesn't end with slash
  const baseUrl = publicBaseUrl.replace(/\/$/, "");
  return `${baseUrl}/${key}`;
}

