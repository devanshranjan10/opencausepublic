import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Only initialize Firebase if we have required config
const hasFirebaseConfig = 
  firebaseConfig.apiKey && 
  firebaseConfig.projectId && 
  firebaseConfig.authDomain;

// Initialize Firebase
let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let firestore: Firestore | null = null;
let auth: Auth | null = null;

if (typeof window !== "undefined" && hasFirebaseConfig) {
  // Only initialize on client side if config is available
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }

    // Initialize Analytics (only in browser and production)
    if (process.env.NODE_ENV === "production" && firebaseConfig.measurementId) {
      try {
        analytics = getAnalytics(app);
      } catch (analyticsError) {
        console.warn("Failed to initialize Analytics:", analyticsError);
      }
    }

    firestore = getFirestore(app);
    auth = getAuth(app);
  } catch (error) {
    console.warn("Failed to initialize Firebase:", error);
  }
} else if (!hasFirebaseConfig) {
  // Don't throw during module initialization (would break SSG/build)
  // Only warn at runtime when Firebase is actually used
  // The getter functions (getFirestoreInstance, getAuthInstance) will throw at runtime if needed
  if (typeof window !== "undefined") {
    console.warn("Firebase config is missing. Firebase features will be disabled. Please set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, and NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variables.");
  }
}

export { app, analytics, firestore, auth };
export default app;

// Type-safe exports with null checks
export const getFirestoreInstance = (): Firestore => {
  if (!firestore) {
    throw new Error("Firestore not initialized. Check Firebase configuration.");
  }
  return firestore;
};

export const getAuthInstance = (): Auth => {
  if (!auth) {
    throw new Error("Auth not initialized. Check Firebase configuration.");
  }
  return auth;
};

