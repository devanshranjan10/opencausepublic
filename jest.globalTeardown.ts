import { cleanupFirestoreEmulator } from "./packages/testkit/src/firebaseEmulator";

export default async function globalTeardown() {
  console.log("🧹 Cleaning up Firebase emulator...");
  await cleanupFirestoreEmulator();
  // Emulator process will exit when test process ends
}






