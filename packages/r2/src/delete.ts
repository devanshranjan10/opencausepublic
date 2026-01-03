import { DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "./r2Client";

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "opencause";

/**
 * Delete an object from R2
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getR2Client();
  
  await client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );
}

/**
 * Delete multiple objects from R2
 */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  
  const client = getR2Client();
  
  // R2 supports batch delete via DeleteObjectsCommand (up to 1000 objects per batch)
  const batchSize = 1000;
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
          Quiet: true,
        },
      })
    );
  }
}
