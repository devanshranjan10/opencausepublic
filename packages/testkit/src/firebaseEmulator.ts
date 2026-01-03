import { initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";

let env: RulesTestEnvironment | null = null;

export async function startFirestoreEmulator(): Promise<RulesTestEnvironment> {
  if (env) return env;

  try {
    env = await initializeTestEnvironment({
      projectId: "opencause-test",
      firestore: {
        host: "127.0.0.1",
        port: 8080,
      },
    });

    return env;
  } catch (error) {
    console.warn("Firebase emulator initialization failed:", error);
    throw error;
  }
}

export async function cleanupFirestoreEmulator(): Promise<void> {
  if (env) {
    try {
      await env.cleanup();
    } catch (error) {
      console.warn("Firebase emulator cleanup error:", error);
    }
    env = null;
  }
}

export function getFirestoreEmulator(): RulesTestEnvironment | null {
  return env;
}






