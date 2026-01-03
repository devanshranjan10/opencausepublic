import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Req,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt.guard";
import { ProofsService } from "./proofs.service";
import Busboy from "busboy";
import * as admin from "firebase-admin";
import { getPublicUrl } from "@opencause/r2";

@Controller()
export class ProofsController {
  constructor(private proofsService: ProofsService) {}

  /**
   * POST /campaigns/:campaignId/proofs/upload (for new withdrawals)
   * Upload proof file for a campaign (before withdrawal creation)
   */
  @Post("campaigns/:campaignId/proofs/upload")
  @UseGuards(JwtAuthGuard)
  async uploadProofForCampaign(@Param("campaignId") campaignId: string, @Req() req: any): Promise<any> {
    return this.handleProofUpload(req, { campaignId, withdrawalId: null });
  }

  /**
   * POST /withdrawals/:withdrawalId/proofs/upload
   * Upload proof file for a withdrawal
   */
  @Post("withdrawals/:withdrawalId/proofs/upload")
  @UseGuards(JwtAuthGuard)
  async uploadProof(@Param("withdrawalId") withdrawalId: string, @Req() req: any): Promise<any> {
    // Get withdrawal to get campaignId
    const withdrawalDoc = await admin.firestore().collection("withdrawals").doc(withdrawalId).get();
    if (!withdrawalDoc.exists) {
      throw new NotFoundException(`Withdrawal ${withdrawalId} not found`);
    }
    const withdrawal = withdrawalDoc.data();
    const campaignId = withdrawal?.campaignId;
    if (!campaignId) {
      throw new BadRequestException("Withdrawal missing campaignId");
    }

    // Verify user owns the withdrawal or is admin
    const userId = req.user.id;
    if (withdrawal?.organizerId !== userId && req.user.role !== "ADMIN") {
      throw new ForbiddenException("Only withdrawal organizer can upload proofs");
    }

    return this.handleProofUpload(req, { campaignId, withdrawalId });
  }

  /**
   * Shared handler for proof upload
   */
  private handleProofUpload(
    req: any,
    context: { campaignId: string; withdrawalId: string | null }
  ): Promise<any> {
    const { campaignId, withdrawalId } = context;
    return new Promise((resolve, reject) => {
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "application/pdf",
      ];

      const contentType = req.headers["content-type"] || "";
      if (!contentType.includes("multipart/form-data")) {
        return reject(new BadRequestException("Content-Type must be multipart/form-data"));
      }

      const busboy = Busboy({
        headers: req.headers,
        limits: {
          fileSize: 10 * 1024 * 1024, // 10MB
        },
      });

      let fileBuffer: Buffer | null = null;
      let fileMimeType: string | null = null;
      let filename: string | null = null;

      busboy.on("file", (fieldname, file, info) => {
        if (fieldname !== "file") {
          file.resume();
          return;
        }

        const { filename: fn, mimeType } = info;
        filename = fn || "unknown";

        // Validate file type
        if (!allowedTypes.includes(mimeType)) {
          file.resume();
          return reject(
            new BadRequestException(
              `Invalid file type. Allowed: ${allowedTypes.join(", ")}. Got: ${mimeType}`
            )
          );
        }

        fileMimeType = mimeType;
        const chunks: Buffer[] = [];

        file.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        file.on("end", () => {
          fileBuffer = Buffer.concat(chunks);
        });

        file.on("error", (err: Error) => {
          reject(new BadRequestException(`Error reading file: ${err.message}`));
        });
      });

      busboy.on("finish", async () => {
        if (!fileBuffer || !fileMimeType || !filename) {
          return reject(new BadRequestException("No file uploaded"));
        }

        try {
          const userId = req.user.id;

          // For new withdrawals (withdrawalId is null), use a temporary ID
          // The proof will be associated when the withdrawal is created
          const effectiveWithdrawalId = withdrawalId || `temp_${userId}_${Date.now()}`;

          // Upload proof
          const result = await this.proofsService.uploadProof({
            campaignId,
            withdrawalId: effectiveWithdrawalId,
            buffer: fileBuffer,
            mimeType: fileMimeType,
            filename,
            createdByUid: userId,
          });

          resolve({
            proofId: result.proofId,
            objectKey: result.objectKey,
            isPublic: result.isPublic,
            url: result.url,
          });
        } catch (err: any) {
          reject(new BadRequestException(`Error uploading proof: ${err.message}`));
        }
      });

      busboy.on("error", (err: Error) => {
        reject(new BadRequestException(`Error parsing multipart data: ${err.message}`));
      });

      // Pipe request stream to busboy
      const requestStream = (req as any).raw || req;
      if (!requestStream || typeof requestStream.pipe !== "function") {
        return reject(new BadRequestException("Request body stream not available"));
      }

      requestStream.pipe(busboy);
    });
  }

  /**
   * GET /proofs/:proofId/url
   * Get URL for a proof (public or signed)
   * Auth is optional - public proofs accessible without auth, private proofs require auth
   */
  @Get("proofs/:proofId/url")
  @UseGuards(OptionalJwtAuthGuard)
  async getProofUrl(@Param("proofId") proofId: string, @Req() req: any): Promise<{ url: string }> {
    const proof = await this.proofsService.getProofById(proofId);
    const user = (req as any).user; // Will be undefined if no valid token

    // Check access for private proofs
    const checkAccess = (p: any) => {
      if (p.isPublic) {
        return true; // Public proofs are accessible to everyone
      }

      // Private proofs require authentication
      if (!user) {
        return false;
      }

      // Admin and reviewers can access any proof
      if (user.role === "ADMIN" || user.role === "REVIEWER") {
        return true;
      }

      // Campaign organizers can access proofs for their campaigns
      // This would require loading the campaign, but for now we'll allow authenticated users
      // TODO: Add proper campaign ownership check
      return true;
    };

    const url = await this.proofsService.getProofUrl(proofId, {
      uid: (req as any).user?.id || null,
      ip: req.ip || req.headers["x-forwarded-for"] || null,
      userAgent: req.headers["user-agent"] || null,
      checkAccess,
    });

    return { url };
  }

  /**
   * GET /withdrawals/:withdrawalId/proofs
   * List all proofs for a withdrawal
   */
  @Get("withdrawals/:withdrawalId/proofs")
  @UseGuards(JwtAuthGuard)
  async listProofs(@Param("withdrawalId") withdrawalId: string): Promise<any[]> {
    const proofs = await this.proofsService.listProofsByWithdrawalId(withdrawalId);
    
    // Return proofs with URLs if public
    return proofs.map((proof) => ({
      proofId: proof.proofId,
      mimeType: proof.mimeType,
      size: proof.size,
      isPublic: proof.isPublic,
      createdAt: proof.createdAt,
      url: proof.isPublic ? getPublicUrl(proof.objectKey) : null,
    }));
  }

  /**
   * GET /campaigns/:campaignId/proofs
   * List public proofs for a campaign
   */
  @Get("campaigns/:campaignId/proofs")
  async listPublicProofs(@Param("campaignId") campaignId: string): Promise<any[]> {
    const proofs = await this.proofsService.listPublicProofsByCampaignId(campaignId);
    
    return proofs.map((proof) => ({
      proofId: proof.proofId,
      mimeType: proof.mimeType,
      size: proof.size,
      createdAt: proof.createdAt,
      url: getPublicUrl(proof.objectKey) || null,
    }));
  }
}
