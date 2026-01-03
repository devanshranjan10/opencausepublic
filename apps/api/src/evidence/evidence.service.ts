import { Injectable } from "@nestjs/common";
import { EvidenceBundle } from "@opencause/types";
import { createHash } from "crypto";
import canonicalize from "canonicalize";
import { QueueService } from "../queue/queue.service";

@Injectable()
export class EvidenceService {
  constructor(private queueService: QueueService) {}

  /**
   * Create evidence bundle: canonicalize JSON, hash, and pin to IPFS
   */
  async createEvidenceBundle(bundle: EvidenceBundle): Promise<{ evidenceHash: string; evidenceCid?: string }> {
    // Canonicalize JSON deterministically
    const canonical = canonicalize(bundle);
    if (!canonical) {
      throw new Error("Failed to canonicalize evidence bundle");
    }

    // Generate hash
    const evidenceHash = createHash("sha256").update(canonical).digest("hex");

    // Queue IPFS pinning job
    await this.queueService.addIPFSPinJob({
      data: canonical,
      evidenceHash,
    });

    // For MVP, return hash immediately (CID will be updated async)
    return { evidenceHash };
  }

  /**
   * Verify evidence hash by recomputing from canonical JSON
   */
  verifyEvidenceHash(bundle: EvidenceBundle, expectedHash: string): boolean {
    const canonical = canonicalize(bundle);
    if (!canonical) {
      return false;
    }
    const computedHash = createHash("sha256").update(canonical).digest("hex");
    return computedHash === expectedHash.replace("0x", "");
  }
}


