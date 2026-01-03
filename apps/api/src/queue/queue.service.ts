import { Injectable } from "@nestjs/common";

/**
 * QueueService - No-op stub (Redis/BullMQ removed)
 * Jobs are processed synchronously or skipped
 */
@Injectable()
export class QueueService {
  async addNotificationJob(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
  }) {
    // No-op: Redis/BullMQ removed
    console.log("Notification job (no-op):", data.title);
    return null;
  }

  async addIPFSPinJob(data: { data: string; evidenceHash: string }) {
    // No-op: Redis/BullMQ removed
    console.log("IPFS pin job (no-op) for evidence:", data.evidenceHash);
    return null;
  }
}


