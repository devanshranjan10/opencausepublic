import { execSync } from "node:child_process";
import * as fs from "fs";

export default async function globalSetup() {
  console.log("🚀 Starting Firebase emulators...");
  
  // Ensure emulator data directory exists
  if (!fs.existsSync(".emulator-data")) {
    fs.mkdirSync(".emulator-data", { recursive: true });
  }

  // Start firebase emulator suite in background
  try {
    execSync(
      "pnpm -w firebase emulators:start --only firestore --project opencause-test --import=./.emulator-data --export-on-exit=./.emulator-data > /tmp/firebase-emulator.log 2>&1 &",
      { stdio: "ignore" }
    );
    
    // Wait for emulator to be ready
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    // Test connection
    let retries = 10;
    while (retries > 0) {
      try {
        const response = await fetch("http://127.0.0.1:8080");
        if (response.ok || response.status === 404) {
          console.log("✅ Firebase emulator ready");
          break;
        }
      } catch {
        retries--;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  } catch (error) {
    console.warn("⚠️ Firebase emulator start failed, tests may use mock:", error);
  }
}






