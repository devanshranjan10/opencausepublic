import { KYCRecord, KYCFormData, FaceData } from "./types";
import { encrypt, decrypt, getOrCreateUserKey, hashData } from "./encryption";
import { KYC_CONFIG } from "./config";

const DB_NAME = KYC_CONFIG.dbName;
const DB_VERSION = KYC_CONFIG.dbVersion;
const STORE_NAME = KYC_CONFIG.storeName;

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
export async function initDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open IndexedDB"));
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      if (dbInstance) {
        resolve(dbInstance);
      } else {
        reject(new Error("Failed to get database instance"));
      }
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: "recordId" });
        objectStore.createIndex("userId", "userId", { unique: false });
        objectStore.createIndex("status", "status", { unique: false });
        objectStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

/**
 * Encrypt sensitive data before storage
 */
function encryptRecord(record: KYCRecord, userId: string): any {
  const key = getOrCreateUserKey(userId);
  
  return {
    recordId: record.recordId,
    userId: record.userId,
    timestamp: record.timestamp,
    formData: encrypt(JSON.stringify(record.formData), key),
    faceImage: encrypt(JSON.stringify(record.faceImage), key),
    livenessImages: encrypt(JSON.stringify(record.livenessImages), key),
    faceMatchScore: record.faceMatchScore,
    status: record.status,
    blockchainHash: record.blockchainHash,
    blockchainTxId: record.blockchainTxId,
    reviewerNotes: record.reviewerNotes,
    reviewedAt: record.reviewedAt,
    reviewedBy: record.reviewedBy,
  };
}

/**
 * Decrypt sensitive data after retrieval
 */
function decryptRecord(encryptedRecord: any, userId: string): KYCRecord {
  const key = getOrCreateUserKey(userId);
  
  return {
    recordId: encryptedRecord.recordId,
    userId: encryptedRecord.userId,
    timestamp: encryptedRecord.timestamp,
    formData: JSON.parse(decrypt(encryptedRecord.formData, key)),
    faceImage: JSON.parse(decrypt(encryptedRecord.faceImage, key)),
    livenessImages: JSON.parse(decrypt(encryptedRecord.livenessImages, key)),
    faceMatchScore: encryptedRecord.faceMatchScore,
    status: encryptedRecord.status,
    blockchainHash: encryptedRecord.blockchainHash,
    blockchainTxId: encryptedRecord.blockchainTxId,
    reviewerNotes: encryptedRecord.reviewerNotes,
    reviewedAt: encryptedRecord.reviewedAt,
    reviewedBy: encryptedRecord.reviewedBy,
  };
}

/**
 * Create a new KYC record
 */
export async function createKYCRecord(record: KYCRecord): Promise<void> {
  const db = await initDatabase();
  const encryptedRecord = encryptRecord(record, record.userId);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(encryptedRecord);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Failed to create KYC record"));
  });
}

/**
 * Get KYC record by ID
 */
export async function getKYCRecord(recordId: string, userId: string): Promise<KYCRecord | null> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(recordId);

    request.onsuccess = () => {
      if (request.result) {
        try {
          const decrypted = decryptRecord(request.result, userId);
          resolve(decrypted);
        } catch (error) {
          reject(new Error("Failed to decrypt record"));
        }
      } else {
        resolve(null);
      }
    };

    request.onerror = () => reject(new Error("Failed to get KYC record"));
  });
}

/**
 * Get all KYC records for a user
 */
export async function getUserKYCRecords(userId: string): Promise<KYCRecord[]> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("userId");
    const request = index.getAll(userId);

    request.onsuccess = () => {
      try {
        const records = request.result.map((encrypted: any) => decryptRecord(encrypted, userId));
        resolve(records.sort((a, b) => b.timestamp - a.timestamp));
      } catch (error) {
        reject(new Error("Failed to decrypt records"));
      }
    };

    request.onerror = () => reject(new Error("Failed to get KYC records"));
  });
}

/**
 * Get all KYC records (admin only - returns encrypted, decryption handled separately)
 */
export async function getAllKYCRecords(): Promise<any[]> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(new Error("Failed to get all KYC records"));
  });
}

/**
 * Update KYC record status
 */
export async function updateKYCStatus(
  recordId: string,
  userId: string,
  status: KYCRecord["status"],
  blockchainHash?: string,
  blockchainTxId?: string,
  reviewerNotes?: string,
  reviewedBy?: string
): Promise<void> {
  const db = await initDatabase();

  return new Promise(async (resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(recordId);

    getRequest.onsuccess = async () => {
      if (!getRequest.result) {
        reject(new Error("Record not found"));
        return;
      }

      try {
        const encryptedRecord = getRequest.result;
        const record = decryptRecord(encryptedRecord, userId);
        
        record.status = status;
        if (blockchainHash) record.blockchainHash = blockchainHash;
        if (blockchainTxId) record.blockchainTxId = blockchainTxId;
        if (reviewerNotes !== undefined) record.reviewerNotes = reviewerNotes;
        if (reviewedBy) record.reviewedBy = reviewedBy;
        record.reviewedAt = Date.now();

        const updatedEncrypted = encryptRecord(record, userId);
        const updateRequest = store.put(updatedEncrypted);

        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(new Error("Failed to update record"));
      } catch (error) {
        reject(new Error("Failed to decrypt/encrypt record"));
      }
    };

    getRequest.onerror = () => reject(new Error("Failed to get record for update"));
  });
}

/**
 * Delete KYC record
 */
export async function deleteKYCRecord(recordId: string): Promise<void> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(recordId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Failed to delete KYC record"));
  });
}

/**
 * Search KYC records by status
 */
export async function getKYCRecordsByStatus(
  status: KYCRecord["status"],
  userId?: string
): Promise<KYCRecord[]> {
  const db = await initDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("status");
    const request = index.getAll(status);

    request.onsuccess = () => {
      try {
        let records = request.result;
        
        // Filter by userId if provided
        if (userId) {
          records = records.filter((r: any) => r.userId === userId);
        }

        const decrypted = records
          .map((encrypted: any) => {
            try {
              return decryptRecord(encrypted, encrypted.userId);
            } catch (error) {
              console.error("Failed to decrypt record:", error);
              return null;
            }
          })
          .filter((r: any): r is KYCRecord => r !== null);

        resolve(decrypted.sort((a, b) => b.timestamp - a.timestamp));
      } catch (error) {
        reject(new Error("Failed to decrypt records"));
      }
    };

    request.onerror = () => reject(new Error("Failed to search KYC records"));
  });
}

