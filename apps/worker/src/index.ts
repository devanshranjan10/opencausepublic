/**
 * Worker Service
 * 
 * Auto-detection worker for crypto payment intents.
 * Scans EVM chains for incoming payments and updates Firestore.
 */

import * as admin from "firebase-admin";
import { IntentWatchProcessor } from "./jobs/intent-watch.processor";

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
    console.log("✅ Firebase Admin initialized with service account");
  } else if (serviceAccountPath) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
      projectId,
    });
    console.log("✅ Firebase Admin initialized with service account path");
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    console.log("✅ Firebase Admin initialized with default credentials");
  }
}

const processor = new IntentWatchProcessor();

// Run detection tick every 10 seconds
const TICK_INTERVAL_MS = 10000;

console.log("🚀 Intent Watch Processor started");
console.log(`📡 Scanning every ${TICK_INTERVAL_MS / 1000} seconds`);

// Run initial tick
processor.tick().catch((error) => {
  console.error("❌ Error in initial tick:", error);
});

// Schedule periodic ticks
setInterval(() => {
  processor.tick().catch((error) => {
    console.error("❌ Error in tick:", error);
  });
}, TICK_INTERVAL_MS);

// Keep process alive
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully...");
  process.exit(0);
});
