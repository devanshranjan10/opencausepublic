import { PutObjectCommand, PutObjectCommandInput } from "@aws-sdk/client-s3";
import { getR2Client } from "./r2Client";

export interface UploadBufferParams {
  key: string;
  buffer: Buffer;
  contentType: string;
}

/**
 * Upload buffer to R2
 * Returns the object key if successful
 */
export async function uploadBuffer(params: UploadBufferParams): Promise<string> {
  const { key, buffer, contentType } = params;
  const bucket = process.env.R2_BUCKET || "opencause-proofs";

  if (!bucket) {
    throw new Error("R2_BUCKET environment variable is required");
  }

  const client = getR2Client();

  const commandInput: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  };

  const command = new PutObjectCommand(commandInput);
  await client.send(command);

  return key;
}

