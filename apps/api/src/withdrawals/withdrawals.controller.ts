import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Put,
  Query,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { WithdrawalsService } from "./withdrawals.service";
import { WithdrawalsCryptoService } from "./withdrawals-crypto.service";
import { CreateWithdrawalDto } from "@opencause/types";

@Controller("withdrawals")
export class WithdrawalsController {
  constructor(
    private withdrawalsService: WithdrawalsService,
    private withdrawalsCrypto: WithdrawalsCryptoService
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req, @Body() dto: CreateWithdrawalDto) {
    return this.withdrawalsService.create(req.user.id, dto);
  }

  @Put(":id/approve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("REVIEWER", "ADMIN")
  async approve(@Param("id") id: string, @Request() req, @Body() body: { notes?: string }) {
    return this.withdrawalsService.approve(id, req.user.id, body.notes);
  }

  @Put(":id/reject")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("REVIEWER", "ADMIN")
  async reject(
    @Param("id") id: string,
    @Request() req,
    @Body() body: { reasonPublic: string; reasonInternal?: string }
  ) {
    return this.withdrawalsService.reject(id, req.user.id, body.reasonPublic, body.reasonInternal);
  }

  @Get("campaign/:campaignId/public")
  async getPublicWithdrawals(@Param("campaignId") campaignId: string) {
    return this.withdrawalsService.getPublicWithdrawals(campaignId);
  }

  @Get()
  async findAll(@Query() query: any) {
    if (query.campaignId) {
      return this.withdrawalsService.findByCampaign(query.campaignId);
    }
    return [];
  }

  @Get("campaign/:campaignId")
  async findByCampaign(@Param("campaignId") campaignId: string) {
    return this.withdrawalsService.findByCampaign(campaignId);
  }

  @Get("campaign/:campaignId/balance")
  async getAvailableBalance(@Param("campaignId") campaignId: string) {
    return this.withdrawalsService.getAvailableBalance(campaignId);
  }

  @Put(":id/mark-payout-completed")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async markPayoutCompleted(
    @Param("id") id: string,
    @Request() req,
    @Body() body: { payoutId?: string; notes?: string }
  ) {
    return this.withdrawalsService.markPayoutCompleted(id, req.user.id, body.payoutId, body.notes);
  }

  @Get("campaign/:campaignId/vault-balance")
  @UseGuards(JwtAuthGuard)
  async getVaultBalance(
    @Param("campaignId") campaignId: string,
    @Query("tokenAddress") tokenAddress?: string
  ) {
    return this.withdrawalsService.getVaultBalance(campaignId, tokenAddress);
  }

  // Crypto withdrawal endpoints
  @Post("crypto")
  @UseGuards(JwtAuthGuard)
  async createCryptoWithdrawal(
    @Request() req,
    @Body() dto: {
      campaignId: string;
      assetId: string;
      networkId: string;
      amountNative: string;
      toAddress: string;
      proofCids: string[];
    }
  ) {
    return this.withdrawalsCrypto.createWithdrawal(req.user.id, dto);
  }

  @Put("crypto/:id/approve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("REVIEWER", "ADMIN")
  async approveCryptoWithdrawal(
    @Param("id") id: string,
    @Request() req,
    @Body() body: { note?: string }
  ) {
    return this.withdrawalsCrypto.approveWithdrawal(id, req.user.id, body.note);
  }

  @Put("crypto/:id/reject")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("REVIEWER", "ADMIN")
  async rejectCryptoWithdrawal(
    @Param("id") id: string,
    @Request() req,
    @Body() body: { note?: string }
  ) {
    return this.withdrawalsCrypto.rejectWithdrawal(id, req.user.id, body.note);
  }

  @Get("crypto")
  async getCryptoWithdrawals(@Query("campaignId") campaignId?: string) {
    if (!campaignId) {
      return [];
    }
    return this.withdrawalsCrypto.getWithdrawalsByCampaign(campaignId);
  }
}

// Admin finance endpoint in separate controller or here
@Controller("admin")
export class AdminController {
  constructor(
    private withdrawalsCrypto: WithdrawalsCryptoService,
    private withdrawalsService: WithdrawalsService
  ) {}

  @Get("campaigns/:id/finance")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "REVIEWER")
  async getCampaignFinance(@Param("id") campaignId: string) {
    return this.withdrawalsCrypto.getCampaignFinance(campaignId);
  }

  @Get("review/withdrawals")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "REVIEWER")
  async getReviewQueue(@Query("status") status?: string) {
    const reviewStatus = (status || "PENDING") as "PENDING" | "APPROVED" | "REJECTED";
    return this.withdrawalsService.getReviewQueue(reviewStatus);
  }

  @Get("review/withdrawals/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "REVIEWER")
  async getWithdrawalForReview(@Param("id") id: string) {
    return this.withdrawalsService.getWithdrawalForReview(id);
  }
}


