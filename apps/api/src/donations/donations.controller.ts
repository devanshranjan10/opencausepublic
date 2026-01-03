import { Controller, Get, Post, Body, Param, UseGuards, Request, Query } from "@nestjs/common";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DonationsService } from "./donations.service";
import { CreateDonationDto } from "@opencause/types";

@Controller("donations")
export class DonationsController {
  constructor(private donationsService: DonationsService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async create(
    @Request() req, 
    @Body() dto: CreateDonationDto & { guestName?: string; guestEmail?: string }
  ) {
    // Allow guest donations (without authentication)
    // If user is authenticated, use their ID, otherwise create a guest ID
    const userId = (req as any).user?.id || `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return this.donationsService.create(userId, dto, {
      guestName: dto.guestName,
      guestEmail: dto.guestEmail,
    });
  }

  @Get()
  async findAll(@Query() query: any) {
    if (query.donorId) {
      return this.donationsService.findByDonor(query.donorId);
    }
    if (query.campaignId) {
      return this.donationsService.findByCampaign(query.campaignId);
    }
    return [];
  }

  @Get("campaign/:campaignId")
  async findByCampaign(@Param("campaignId") campaignId: string) {
    return this.donationsService.findByCampaign(campaignId);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async findByDonor(@Request() req) {
    return this.donationsService.findByDonor(req.user.id);
  }
}


