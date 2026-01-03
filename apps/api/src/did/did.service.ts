import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";

@Injectable()
export class DIDService {
  /**
   * Generate a DID:key for MVP
   * In production, use proper DID libraries like did-key or did-pkh
   */
  async generateDID(): Promise<string> {
    // For MVP: generate a simple did:key
    const keyMaterial = randomBytes(32).toString("hex");
    return `did:key:z6Mk${keyMaterial.substring(0, 40)}`;
  }

  /**
   * Verify DID format (basic check)
   */
  isValidDID(did: string): boolean {
    return did.startsWith("did:key:") || did.startsWith("did:pkh:");
  }
}


