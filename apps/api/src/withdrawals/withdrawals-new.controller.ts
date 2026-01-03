import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { WithdrawalsNewService } from "./withdrawals-new.service";
import { CreateWithdrawalRequestSchema } from "@opencause/types";

/**
 * Enhanced withdrawal controller with invoice proof validation
 */
@Controller("withdrawals")
export class WithdrawalsNewController {
  constructor(private withdrawalsService: WithdrawalsNewService) {}

  /**
   * POST /withdrawals
   * Create a new withdrawal request
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() body: any) {
    // Validate input with Zod
    const validationResult = CreateWithdrawalRequestSchema.safeParse(body);
    if (!validationResult.success) {
      throw new BadRequestException({
        message: "Validation failed",
        errors: validationResult.error.errors,
      });
    }

    const input = validationResult.data;
    return this.withdrawalsService.createWithdrawalRequest(req.user.id, input);
  }

  /**
   * GET /withdrawals?campaignId=xxx
   * List withdrawals for a campaign
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query() query: { campaignId?: string; userId?: string }) {
    // TODO: Implement list endpoint
    // Should filter by campaignId or userId, return list of withdrawals
    return { withdrawals: [] };
  }

  /**
   * GET /withdrawals/:id
   * Get withdrawal details
   */
  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async findOne(@Param("id") id: string, @Request() req) {
    // TODO: Implement get endpoint
    // Should return withdrawal details, mask bank account, check authorization
    return { id };
  }

  /**
   * PUT /withdrawals/:id/approve
   * Approve withdrawal (admin/reviewer only)
   */
  @Post(":id/approve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "REVIEWER")
  async approve(
    @Param("id") id: string,
    @Request() req,
    @Body() body: { notes?: string }
  ) {
    await this.withdrawalsService.approveWithdrawal(id, req.user.id, body.notes);
    return { success: true };
  }

  /**
   * PUT /withdrawals/:id/reject
   * Reject withdrawal (admin/reviewer only)
   */
  @Post(":id/reject")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "REVIEWER")
  async reject(@Param("id") id: string, @Request() req, @Body() body: { reason: string }) {
    await this.withdrawalsService.rejectWithdrawal(id, req.user.id, body.reason);
    return { success: true };
  }

  /**
   * PUT /withdrawals/:id/mark-paid
   * Mark withdrawal as paid (admin only)
   */
  @Post(":id/mark-paid")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  async markPaid(@Param("id") id: string, @Body() body: { txHash?: string }) {
    await this.withdrawalsService.markPaid(id, body.txHash);
    return { success: true };
  }
}






