import {
  Controller,
  Post,
  UseGuards,
  BadRequestException,
  Req,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

/**
 * File upload controller
 * @deprecated Proof uploads should use ProofsController (/proofs endpoints)
 * Campaign image uploads will be migrated to R2 in the future
 */
@Controller("uploads")
export class UploadController {
  constructor() {
    console.log("UploadController initialized (deprecated - use ProofsController for proof uploads)");
  }

  /**
   * POST /uploads/campaign-image
   * Upload campaign image and return URL + hash
   * @deprecated This will be migrated to R2 in the future
   */
  @Post("campaign-image")
  @UseGuards(JwtAuthGuard)
  async uploadCampaignImage(@Req() req: any): Promise<any> {
    // TODO: Migrate campaign images to R2
    throw new BadRequestException(
      "Campaign image uploads are temporarily disabled. Migration to R2 in progress."
    );
  }

  /**
   * POST /uploads/proof
   * @deprecated Use POST /campaigns/:campaignId/proofs/upload or POST /withdrawals/:withdrawalId/proofs/upload instead
   * This endpoint is kept for backward compatibility but throws an error
   */
  @Post("proof")
  @UseGuards(JwtAuthGuard)
  async uploadProof(@Req() req: any): Promise<any> {
    throw new BadRequestException(
      "This endpoint is deprecated. Use POST /campaigns/:campaignId/proofs/upload or POST /withdrawals/:withdrawalId/proofs/upload instead"
    );
  }
}
