/**
 * Crypto Donation Worker
 * 
 * DISABLED: Redis/BullMQ removed
 * 
 * Workers are no longer available. Consider implementing:
 * - Scheduled tasks using cron jobs
 * - Direct Firestore triggers
 * - HTTP endpoints to trigger jobs manually
 */

import * as admin from "firebase-admin";

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.FIREBASE_PROJECT_ID || "opencausein";

  if (serviceAccount) {
    const serviceAccountJson = typeof serviceAccount === "string" 
      ? JSON.parse(serviceAccount) 
      : serviceAccount;
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountJson),
      projectId,
    });
  } else if (serviceAccountPath) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
      projectId,
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
  }
}

console.log("⚠️  Crypto workers are DISABLED (Redis/BullMQ removed)");
console.log("   Workers that were available:");
console.log("   - EVM Indexer");
console.log("   - UTXO Watcher");
console.log("   - Solana Watcher");
console.log("   - Stats Refresher");
console.log("   - Intent Expirer");
console.log("   - Withdrawal Executor");
console.log("");
console.log("   To process jobs, use:");
console.log("   - Firestore triggers/cloud functions");
console.log("   - Scheduled HTTP endpoints");
console.log("   - Cron jobs");

// Keep process alive
setInterval(() => {
  // Do nothing, just keep alive
}, 60000);
