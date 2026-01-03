/**
 * Intent Expirer Job
 * 
 * Expires old payment intents that haven't been confirmed
 */

import { Job } from "bullmq";
import * as admin from "firebase-admin";
import { FirestoreRepository } from "@opencause/firebase";

export async function processIntentExpirerJob(
  job: Job,
  firestore: admin.firestore.Firestore
): Promise<void> {
  const repo = new FirestoreRepository(firestore);
  const now = admin.firestore.Timestamp.now();
  
  // Get expired intents
  const expired = await repo.getExpiredIntents(now);
  
  for (const intent of expired) {
    if (intent.status === "CREATED" || intent.status === "SEEN" || intent.status === "CONFIRMING") {
      await repo.updatePaymentIntent(intent.intentId, {
        status: "EXPIRED",
      });
      console.log(`✅ Expired intent ${intent.intentId}`);
    }
  }
  
  console.log(`✅ Processed ${expired.length} expired intents`);
}






