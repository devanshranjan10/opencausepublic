import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt.guard";
import { EventService } from "./event.service";
import { MilestoneService } from "./milestone.service";
import { DonationAllocationService } from "./donation-allocation.service";
import { MaskingService } from "./masking.service";
import { EventVisibility } from "@opencause/firebase";

/**
 * Transparency Controller
 * Public and organizer-facing endpoints for campaign transparency
 */
@Controller("campaigns/:campaignId")
export class TransparencyController {
  constructor(
    private eventService: EventService,
    private milestoneService: MilestoneService,
    private allocationService: DonationAllocationService
  ) {}

  /**
   * Get milestones for a campaign (public)
   */
  @Get("milestones")
  @UseGuards(OptionalJwtAuthGuard)
  async getMilestones(@Param("campaignId") campaignId: string) {
    const milestones = await this.milestoneService.getCampaignMilestones(
      campaignId
    );

    // Enrich with allocation data
    const milestonesWithAllocations = await Promise.all(
      milestones.map(async (milestone) => {
        const allocations = await this.allocationService.getMilestoneAllocations(
          milestone.id
        );
        const withdrawableInr =
          milestone.targetAmountInr
            ? await this.allocationService.calculateWithdrawableAmount(
                milestone.id,
                "INR"
              )
            : "0";
        const withdrawableCrypto = milestone.targetAmountCrypto
          ? await this.allocationService.calculateWithdrawableAmount(
              milestone.id,
              milestone.targetCurrency || "ETH"
            )
          : "0";

        return {
          ...milestone,
          allocations,
          withdrawableInr,
          withdrawableCrypto,
        };
      })
    );

    return milestonesWithAllocations;
  }

  /**
   * Get events/activity feed for a campaign
   * Public endpoint (filtered by visibility)
   */
  @Get("events")
  @UseGuards(OptionalJwtAuthGuard)
  async getEvents(
    @Param("campaignId") campaignId: string,
    @Query("visibility") visibility?: EventVisibility | EventVisibility[],
    @Query("limit") limit?: string,
    @Request() req?: any
  ) {
    // Determine visibility based on user role
    let eventVisibility: EventVisibility | EventVisibility[];
    if (visibility) {
      eventVisibility = Array.isArray(visibility)
        ? visibility
        : [visibility];
    } else {
      // Default: show public events, and organizer-only if user is organizer
      const userId = req?.user?.id;
      // TODO: Check if user is campaign organizer
      eventVisibility = userId
        ? ["PUBLIC", "ORGANIZER_ONLY"]
        : ["PUBLIC"];
    }

    const events = await this.eventService.getCampaignEvents(campaignId, {
      visibility: eventVisibility,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    return events;
  }

  /**
   * Get transparency overview (public)
   * Aggregates milestones, withdrawals, and recent events
   */
  @Get("transparency")
  @UseGuards(OptionalJwtAuthGuard)
  async getTransparencyOverview(@Param("campaignId") campaignId: string) {
    const [milestones, recentEvents] = await Promise.all([
      this.milestoneService.getCampaignMilestones(campaignId),
      this.eventService.getCampaignEvents(campaignId, {
        visibility: "PUBLIC",
        limit: 10,
      }),
    ]);

    return {
      milestones,
      recentEvents,
      // TODO: Add withdrawals summary
    };
  }
}






