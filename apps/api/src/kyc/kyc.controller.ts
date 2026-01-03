import { Controller, Post, Get, Put, Delete, Body, Query, Param, UseGuards, Request } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { KYCService } from "./kyc.service";
import { KYCDto } from "@opencause/types";

@Controller("kyc")
export class KYCController {
  constructor(private kycService: KYCService) {}

  @Post("submit")
  @UseGuards(JwtAuthGuard)
  async submitKYC(@Request() req, @Body() dto: any) {
    try {
      const initialStatus = dto.initialStatus || "PENDING";
      const result = await this.kycService.submitKYCData(req.user.id, dto, initialStatus);
      return result;
    } catch (error: any) {
      console.error("[KYC Controller] Error in submitKYC:", error);
      throw error; // Re-throw to let NestJS handle it properly
    }
  }

  @Post("verify")
  async verifyVC(@Body() body: { vcJwt: string }) {
    const vc = await this.kycService.verifyVC(body.vcJwt);
    return { verified: !!vc, vc };
  }

  @Get("status")
  @UseGuards(JwtAuthGuard)
  async getKYCStatus(@Request() req) {
    const status = await this.kycService.getKYCStatus(req.user.id);
    return status || { status: "NOT_STARTED" };
  }

  @Get("list")
  @UseGuards(JwtAuthGuard)
  async getAllKYCRecords(
    @Query("status") status?: string,
    @Query("userId") userId?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    return this.kycService.getAllKYCRecords({
      status,
      userId,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get("stats/summary")
  @UseGuards(JwtAuthGuard)
  async getKYCStats() {
    return this.kycService.getKYCStats();
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async getKYCRecord(@Param("id") id: string) {
    return this.kycService.getKYCRecord(id);
  }

  @Put(":id/status")
  @UseGuards(JwtAuthGuard)
  async updateKYCStatus(
    @Param("id") id: string,
    @Body() body: { status: string; comments?: string }
  ) {
    return this.kycService.updateKYCStatus(id, body.status, body.comments);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async deleteKYCRecord(@Param("id") id: string) {
    return this.kycService.deleteKYCRecord(id);
  }

  @Get(":id/document/:type")
  @UseGuards(JwtAuthGuard)
  async getDocumentUrl(
    @Param("id") id: string,
    @Param("type") type: string,
    @Query("expiresIn") expiresIn?: string
  ) {
    return this.kycService.getDocumentUrl(id, type as any, expiresIn ? parseInt(expiresIn, 10) : undefined);
  }

  @Get(":id/face/:index")
  @UseGuards(JwtAuthGuard)
  async getFaceImageUrl(
    @Param("id") id: string,
    @Param("index") index: string,
    @Query("expiresIn") expiresIn?: string
  ) {
    return this.kycService.getFaceImageUrl(id, parseInt(index, 10), expiresIn ? parseInt(expiresIn, 10) : undefined);
  }

  @Get(":id/liveness/:challengeIndex/:imageIndex")
  @UseGuards(JwtAuthGuard)
  async getLivenessImageUrl(
    @Param("id") id: string,
    @Param("challengeIndex") challengeIndex: string,
    @Param("imageIndex") imageIndex: string,
    @Query("expiresIn") expiresIn?: string
  ) {
    return this.kycService.getLivenessImageUrl(
      id,
      parseInt(challengeIndex, 10),
      parseInt(imageIndex, 10),
      expiresIn ? parseInt(expiresIn, 10) : undefined
    );
  }
}


