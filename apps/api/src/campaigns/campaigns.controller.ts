import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  Put,
  Delete,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CampaignsService } from "./campaigns.service";
import { CampaignBalanceService } from "./campaign-balance.service";
import { CreateCampaignDto } from "@opencause/types";
import { PaymentIntentsService } from "../crypto/payment-intents.service";

@Controller("campaigns")
export class CampaignsController {
  constructor(
    private campaignsService: CampaignsService,
    private campaignBalance: CampaignBalanceService,
    private paymentIntents: PaymentIntentsService
  ) {}

  @Get()
  async findAll(@Query() query: any) {
    // For public access, only show ACTIVE campaigns unless authenticated user requests all
    const filters: any = {};
    if (query.status) {
      filters.status = query.status;
    } else if (!query.includeAll) {
      // Default: only show ACTIVE campaigns to public
      filters.status = "ACTIVE";
    }
    if (query.organizerId) {
      filters.organizerId = query.organizerId;
    }
    if (query.category) {
      filters.category = query.category;
    }
    return this.campaignsService.findAll(filters);
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @Request() req) {
    // Allow viewing campaign details even if not ACTIVE (for organizers/admins)
    return this.campaignsService.findOne(id, (req as any).user?.id);
  }

  @Get(":id/balance")
  @UseGuards(JwtAuthGuard)
  async getBalance(@Param("id") id: string) {
    return this.campaignBalance.getCampaignBalance(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(req.user.id, dto);
  }

  @Put(":id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "REVIEWER")
  async updateStatus(@Param("id") id: string, @Request() req, @Body() body: { status: string; notes?: string }) {
    return this.campaignsService.updateStatus(id, req.user.id, body.status, body.notes);
  }

  @Put(":id/approve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "REVIEWER")
  async approve(@Param("id") id: string, @Request() req, @Body() body: { notes?: string }) {
    return this.campaignsService.approveCampaign(id, req.user.id, body.notes);
  }

  @Put(":id/reject")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "REVIEWER")
  async reject(@Param("id") id: string, @Request() req, @Body() body: { notes?: string }) {
    return this.campaignsService.rejectCampaign(id, req.user.id, body.notes);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async update(@Param("id") id: string, @Request() req, @Body() dto: Partial<CreateCampaignDto>) {
    return this.campaignsService.update(id, req.user.id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async delete(@Param("id") id: string, @Request() req) {
    return this.campaignsService.delete(id, req.user.id);
  }

  @Get(":id/donation-info")
  async getDonationInfo(@Param("id") id: string, @Query("tokenType") tokenType?: string) {
    return this.campaignsService.getDonationInfo(id, tokenType);
  }

  @Post(":id/payment-intents")
  async createPaymentIntent(
    @Param("id") campaignId: string,
    @Body() body: { networkId: string; assetId: string; amountUsd?: string; amountNative?: string }
  ) {
    return this.paymentIntents.createIntent({
      campaignId,
      ...body,
    });
  }
}


