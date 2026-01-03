import { Injectable, OnModuleInit } from "@nestjs/common";
import * as admin from "firebase-admin";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class FirebaseService implements OnModuleInit {
  public firestore: admin.firestore.Firestore;
  public auth: admin.auth.Auth;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Initialize Firebase Admin
    if (!admin.apps.length) {
      const serviceAccount = this.configService.get<string>("FIREBASE_SERVICE_ACCOUNT");
      const serviceAccountPath = this.configService.get<string>("FIREBASE_SERVICE_ACCOUNT_PATH");
      const projectId = this.configService.get<string>("FIREBASE_PROJECT_ID") || "opencausein";
      
      try {
        if (serviceAccount) {
          // Use service account JSON string (production)
          try {
            const serviceAccountJson = typeof serviceAccount === 'string' 
              ? JSON.parse(serviceAccount) 
              : serviceAccount;
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccountJson),
              projectId,
            });
            console.log("[Firebase] Initialized with service account JSON");
          } catch (error: any) {
            console.error("[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT:", error?.message);
            // Try fallback initialization
            try {
              console.warn("[Firebase] Attempting fallback initialization");
              admin.initializeApp({ projectId });
            } catch (fallbackError: any) {
              console.error("[Firebase] Fallback initialization also failed:", fallbackError?.message);
              // Don't throw - allow app to continue (some routes might work without Firebase)
            }
          }
        } else if (serviceAccountPath) {
          // Use service account file path (local development)
          try {
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccountPath),
              projectId,
            });
            console.log("[Firebase] Initialized with service account file");
          } catch (error: any) {
            console.error("[Firebase] Failed to load service account from file:", error?.message);
            // Try fallback initialization
            try {
              console.warn("[Firebase] Attempting fallback initialization");
              admin.initializeApp({ projectId });
            } catch (fallbackError: any) {
              console.error("[Firebase] Fallback initialization also failed:", fallbackError?.message);
              // Don't throw - allow app to continue
            }
          }
        } else {
          // Use default credentials (for Firebase emulator or GCP)
          try {
            admin.initializeApp({
              credential: admin.credential.applicationDefault(),
              projectId,
            });
            console.log("[Firebase] Initialized with application default credentials");
          } catch (error: any) {
            // Fallback: initialize without credentials (for local dev with emulator)
            console.warn("[Firebase] Application default credentials failed, initializing without credentials:", error?.message);
            try {
              admin.initializeApp({
                projectId,
              });
            } catch (finalError: any) {
              console.error("[Firebase] All initialization methods failed:", finalError?.message);
              // Don't throw - allow app to continue (some routes might work without Firebase)
              // In Vercel, we'll handle this gracefully below
            }
          }
        }
      } catch (error: any) {
        // Final fallback - try to initialize with just project ID
        console.warn("[Firebase] Using fallback initialization");
        try {
          admin.initializeApp({ projectId });
        } catch (fallbackError: any) {
          console.error("[Firebase] All initialization methods failed:", fallbackError?.message);
          // In serverless, we might not have credentials - log but don't crash
          if (process.env.VERCEL) {
            console.warn("[Firebase] Running in Vercel without Firebase credentials - some features may not work");
            // Don't throw - let the try-catch in onModuleInit handle it
          } else {
            throw new Error(`Firebase initialization failed: ${fallbackError?.message}`);
          }
        }
      }
    }

    // Check if Firebase app was successfully initialized
    if (!admin.apps.length) {
      const errorMsg = "Firebase app not initialized - check your FIREBASE_SERVICE_ACCOUNT environment variable";
      if (process.env.VERCEL) {
        console.warn(`[Firebase] ${errorMsg} - continuing without Firebase`);
        // Don't throw in Vercel - app will start but Firebase-dependent routes will fail
        return;
      } else {
        throw new Error(errorMsg);
      }
    }
    
    try {
      this.firestore = admin.firestore();
      this.auth = admin.auth();

      // Configure Firestore settings
      this.firestore.settings({
        ignoreUndefinedProperties: true,
      });
      console.log("[Firebase] Firestore and Auth initialized");
    } catch (error: any) {
      console.error("[Firebase] Failed to initialize Firestore/Auth:", error?.message);
      // In serverless environments (Vercel), continue without Firebase if it fails
      // Some routes might still work
      if (process.env.VERCEL) {
        console.warn("[Firebase] Continuing without Firebase in Vercel - some features may not work");
        // Don't throw - app will start but Firebase-dependent routes will fail
        return;
      } else {
        throw error;
      }
    }
  }

  // Collection helpers
  collection(name: string) {
    if (!this.firestore) {
      throw new Error("Firebase Firestore not initialized. Please check your Firebase configuration.");
    }
    return this.firestore.collection(name);
  }

  // User operations
  async getUserById(id: string) {
    const doc = await this.collection("users").doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async getUserByEmail(email: string) {
    const snapshot = await this.collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async createUser(data: any) {
    const docRef = this.collection("users").doc();
    await docRef.set({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: docRef.id, ...data };
  }

  async updateUser(id: string, data: any) {
    await this.collection("users").doc(id).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return this.getUserById(id);
  }

  // Campaign operations
  async getCampaignById(id: string) {
    const doc = await this.collection("campaigns").doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async getCampaigns(filters?: { status?: string; organizerId?: string }) {
    let query: admin.firestore.Query = this.collection("campaigns");
    
    if (filters?.status) {
      query = query.where("status", "==", filters.status);
    }
    if (filters?.organizerId) {
      query = query.where("organizerId", "==", filters.organizerId);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async createCampaign(data: any) {
    const docRef = this.collection("campaigns").doc(data.id || undefined);
    await docRef.set({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: docRef.id, ...data };
  }

  async updateCampaign(id: string, data: any) {
    await this.collection("campaigns").doc(id).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return this.getCampaignById(id);
  }

  // Generic operations
  async create(collection: string, data: any, id?: string): Promise<any> {
    const docRef = id 
      ? this.collection(collection).doc(id)
      : this.collection(collection).doc();
    
    await docRef.set({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: docRef.id, ...data };
  }

  async getById(collection: string, id: string): Promise<any> {
    const doc = await this.collection(collection).doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async update(collection: string, id: string, data: any): Promise<any> {
    await this.collection(collection).doc(id).update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return this.getById(collection, id);
  }

  async delete(collection: string, id: string): Promise<void> {
    await this.collection(collection).doc(id).delete();
  }

  async query(collection: string, field: string, operator: any, value: any): Promise<any[]> {
    const snapshot = await this.collection(collection)
      .where(field, operator, value)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async queryAll(collection: string, filters?: Array<{ field: string; operator: any; value: any }>): Promise<any[]> {
    let query: admin.firestore.Query = this.collection(collection);
    
    if (filters) {
      filters.forEach((filter) => {
        query = query.where(filter.field, filter.operator, filter.value);
      });
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
}

