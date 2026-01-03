import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

let testApp: App | null = null;

export function getTestAdminFirestore(): Firestore {
  if (!testApp) {
    // Initialize with emulator settings
    testApp = initializeApp({
      projectId: "opencause-test",
      credential: cert({
        projectId: "opencause-test",
        clientEmail: "test@opencause-test.iam.gserviceaccount.com",
        // Fake private key for emulator
        privateKey:
          "-----BEGIN PRIVATE KEY-----\nMIIBVAIBADANBgkqhkiG9w0BAQEFAASCAT4wggE6AgEAAkEA0j1ZW1KZQzqG\n-----END PRIVATE KEY-----\n",
      } as any),
    });
  }

  const db = getFirestore(testApp);
  db.settings({
    host: "127.0.0.1:8080",
    ssl: false,
  });

  return db;
}

export async function clearFirestoreCollections(collections: string[]): Promise<void> {
  const db = getTestAdminFirestore();
  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
}






