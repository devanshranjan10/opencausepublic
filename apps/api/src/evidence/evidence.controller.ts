import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { EvidenceService } from "./evidence.service";
import { EvidenceBundle } from "@opencause/types";
import { FirebaseService } from "../firebase/firebase.service";

@Controller("evidence")
export class EvidenceController {
  constructor(
    private evidenceService: EvidenceService,
    private firebase: FirebaseService
  ) {}

  @Post("verify")
  async verify(@Body() body: { bundle: EvidenceBundle; expectedHash: string }) {
    const valid = this.evidenceService.verifyEvidenceHash(body.bundle, body.expectedHash);
    return { valid };
  }

  @Get(":hash")
  async getEvidence(@Param("hash") hash: string) {
    const evidence = await this.firebase.query("evidence", "evidenceHash", "==", hash);

    if (evidence.length === 0) {
      return { found: false };
    }

    return { found: true, evidence: evidence[0] };
  }
}

