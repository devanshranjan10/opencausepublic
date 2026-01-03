/**
 * Seed Crypto Registry
 * 
 * Populates Firestore with crypto_networks and crypto_assets from the registry.
 */

import * as admin from "firebase-admin";
import { NETWORKS, ASSETS } from "@opencause/crypto-core";

export async function seedCryptoRegistry(firestore: admin.firestore.Firestore) {
  console.log("🌱 Seeding crypto networks and assets...");

  const batch = firestore.batch();
  let count = 0;

  // Seed networks
  for (const [networkId, network] of Object.entries(NETWORKS)) {
    const docRef = firestore.collection("crypto_networks").doc(networkId);
    batch.set(docRef, {
      ...network,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    count++;
  }

  // Seed assets
  for (const asset of ASSETS) {
    const docRef = firestore.collection("crypto_assets").doc(asset.assetId);
    batch.set(docRef, {
      ...asset,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    count++;
  }

  await batch.commit();
  console.log(`✅ Seeded ${Object.keys(NETWORKS).length} networks and ${ASSETS.length} assets (${count} total docs)`);
}






