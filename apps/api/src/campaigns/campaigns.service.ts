import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, forwardRef } from "@nestjs/common";
import { FirebaseService } from "../firebase/firebase.service";
import { CreateCampaignDto } from "@opencause/types";
import { Web3Service } from "../web3/web3.service";
import { KYCService } from "../kyc/kyc.service";
import { randomBytes } from "crypto";

@Injectable()
export class CampaignsService {
  constructor(
    private firebase: FirebaseService,
    private web3Service: Web3Service,
    @Inject(forwardRef(() => KYCService))
    private kycService: KYCService,
  ) {}

  async create(userId: string, dto: CreateCampaignDto) {
    // Check user is organizer
    const user = await this.firebase.getUserById(userId) as any;
    if (!user || (user.role !== "INDIVIDUAL_ORGANIZER" && user.role !== "NGO_ORGANIZER")) {
      throw new ForbiddenException("Only organizers can create campaigns");
    }

    // For INDIVIDUAL_ORGANIZER, require KYC verification
    if (user.role === "INDIVIDUAL_ORGANIZER" && this.kycService) {
      const kycStatus = await this.kycService.getKYCStatus(userId);
      
      if (!kycStatus || kycStatus.status !== "VERIFIED") {
        const currentStatus = kycStatus?.status || "NOT_STARTED";
        throw new ForbiddenException(
          `Complete KYC to start a campaign. Current status: ${currentStatus}. Please complete KYC verification first.`
        );
      }
    }

    // Generate campaign ID
    const campaignId = randomBytes(16).toString("hex");

    // Deploy vault on-chain (stub for MVP - will use actual contract deployment)
    let vaultAddress: string | undefined;
    try {
      vaultAddress = await this.web3Service.deployCampaignVault(campaignId, user.walletAddress || "");
    } catch (error) {
      console.error("Failed to deploy vault:", error);
      // Continue without vault for MVP
    }

    // Create campaign
    const campaign = await this.firebase.createCampaign({
      id: campaignId,
      title: dto.title,
      description: dto.description,
      category: dto.category,
      goalInr: dto.goalInr,
      goalCrypto: dto.goalCrypto || "0",
      raisedInr: "0",
      raisedCrypto: "0",
      withdrawnInr: "0",
      withdrawnCrypto: "0",
      organizerId: userId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      imageUrl: dto.imageUrl,
      status: "PENDING_REVIEW", // Campaigns must be reviewed before going live
      vaultAddress,
    });

    // Create milestones
    const milestones = await Promise.all(
      dto.milestones.map((m) =>
        this.firebase.create("milestones", {
          campaignId: campaign.id,
          name: m.name,
          description: m.description,
          capAmount: m.capAmount,
          proofTypes: m.proofTypes,
          coolingOffHours: m.coolingOffHours,
          reviewWindowHours: m.reviewWindowHours,
          releasedAmount: "0",
          status: m.status || "PENDING",
        })
      )
    );

    return { ...campaign, milestones };
  }

  async findAll(filters?: { status?: string; category?: string; organizerId?: string }) {
    try {
      const firebaseFilters: Array<{ field: string; operator: any; value: any }> = [];
      
      if (filters?.status) {
        firebaseFilters.push({ field: "status", operator: "==", value: filters.status });
      }
      if (filters?.organizerId) {
        firebaseFilters.push({ field: "organizerId", operator: "==", value: filters.organizerId });
      }
      
      // If no filters, get all campaigns
      const campaigns = firebaseFilters.length > 0
        ? await this.firebase.queryAll("campaigns", firebaseFilters)
        : await this.firebase.queryAll("campaigns");
    
    // Get organizer info and milestones for each campaign
    const campaignsWithDetails = await Promise.all(
      campaigns.map(async (campaign: any) => {
        const organizer = await this.firebase.getUserById(campaign.organizerId);
        const milestones = await this.firebase.query("milestones", "campaignId", "==", campaign.id);
        const donations = await this.firebase.query("donations", "campaignId", "==", campaign.id);
        const withdrawals = await this.firebase.query("withdrawals", "campaignId", "==", campaign.id);
        
        return {
          ...campaign,
          organizer: organizer ? {
            id: organizer.id,
            name: (organizer as any).name,
            email: (organizer as any).email,
          } : null,
          milestones,
          _count: {
            donations: donations.length,
            withdrawals: withdrawals.length,
          },
        };
      })
    );
    
    return campaignsWithDetails.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : 
                   ((a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : 0) ||
                   new Date(a.createdAt || 0).getTime();
      const bTime = b.createdAt?.toDate?.() ? b.createdAt.toDate().getTime() : 
                   ((b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : 0) ||
                   new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      return [];
    }
  }

  async findOne(id: string, userId?: string) {
    const campaign = await this.firebase.getCampaignById(id) as any;

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    // Check if user is organizer, admin, or reviewer (they can view any status)
    let canView = false;
    if (userId) {
      const user = await this.firebase.getUserById(userId) as any;
      if (user) {
        canView = 
          user.role === "ADMIN" || 
          user.role === "REVIEWER" || 
          campaign.organizerId === userId;
      }
    }

    // Only ACTIVE campaigns are visible to public, but organizers/admins can see their own
    if (campaign.status !== "ACTIVE" && !canView) {
      throw new NotFoundException("Campaign not found or not active");
    }

    // Get related data
    const organizer = await this.firebase.getUserById(campaign.organizerId) as any;
    const milestones = await this.firebase.query("milestones", "campaignId", "==", id);
    const donations = await this.firebase.query("donations", "campaignId", "==", id);
    const withdrawals = await this.firebase.query("withdrawals", "campaignId", "==", id);

    // Get donor info for donations
    const donationsWithDonors = await Promise.all(
      donations.slice(0, 10).map(async (d: any) => {
        const donor = await this.firebase.getUserById(d.donorId);
        return {
          ...d,
          donor: donor ? { id: donor.id, name: (donor as any).name } : null,
        };
      })
    );

    return {
      ...campaign,
      organizer: organizer ? {
        id: organizer.id,
        name: (organizer as any).name,
        email: (organizer as any).email,
        did: (organizer as any).did,
        kycStatus: (organizer as any).kycStatus,
      } : null,
      milestones,
      donations: donationsWithDonors,
      withdrawals: withdrawals.slice(0, 10),
      _count: {
        donations: donations.length,
        withdrawals: withdrawals.length,
      },
    };
  }

  async getMilestones(id: string) {
    const milestones = await this.firebase.query("milestones", "campaignId", "==", id);
    return milestones;
  }

  async updateStatus(id: string, userId: string, status: string, notes?: string) {
    const campaign = await this.firebase.getCampaignById(id) as any;

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    // Check if user is admin or the organizer
    const user = await this.firebase.getUserById(userId) as any;
    if (user.role !== "ADMIN" && campaign.organizerId !== userId) {
      throw new ForbiddenException("Only admin or organizer can update campaign status");
    }

    const updateData: any = { status };
    if (notes) {
      updateData.reviewNotes = notes;
      updateData.reviewedBy = userId;
      updateData.reviewedAt = new Date().toISOString();
    }

    return this.firebase.updateCampaign(id, updateData);
  }

  async approveCampaign(id: string, userId: string, notes?: string) {
    const campaign = await this.firebase.getCampaignById(id) as any;

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    if (campaign.status !== "PENDING_REVIEW") {
      throw new ForbiddenException("Only campaigns pending review can be approved");
    }

    return this.firebase.updateCampaign(id, {
      status: "ACTIVE",
      reviewNotes: notes,
      reviewedBy: userId,
      reviewedAt: new Date().toISOString(),
    });
  }

  async rejectCampaign(id: string, userId: string, notes?: string) {
    const campaign = await this.firebase.getCampaignById(id) as any;

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    if (campaign.status !== "PENDING_REVIEW") {
      throw new ForbiddenException("Only campaigns pending review can be rejected");
    }

    return this.firebase.updateCampaign(id, {
      status: "REJECTED",
      reviewNotes: notes,
      reviewedBy: userId,
      reviewedAt: new Date().toISOString(),
    });
  }

  async update(id: string, userId: string, dto: Partial<CreateCampaignDto>) {
    const campaign = await this.firebase.getCampaignById(id) as any;

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    // Only admin can update campaigns
    const user = await this.firebase.getUserById(userId) as any;
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Only admin can update campaigns");
    }

    const updateData: any = {};
    if (dto.title) updateData.title = dto.title;
    if (dto.description) updateData.description = dto.description;
    if (dto.category) updateData.category = dto.category;
    if (dto.goalInr) updateData.goalInr = dto.goalInr;
    if (dto.goalCrypto) updateData.goalCrypto = dto.goalCrypto;
    if (dto.startDate) updateData.startDate = dto.startDate;
    if (dto.endDate) updateData.endDate = dto.endDate;
    if (dto.imageUrl) updateData.imageUrl = dto.imageUrl;

    return this.firebase.updateCampaign(id, updateData);
  }

  async delete(id: string, userId: string) {
    const campaign = await this.firebase.getCampaignById(id) as any;

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    // Only admin can delete campaigns
    const user = await this.firebase.getUserById(userId) as any;
    if (user.role !== "ADMIN") {
      throw new ForbiddenException("Only admin can delete campaigns");
    }

    // Delete related milestones
    const milestones = await this.firebase.query("milestones", "campaignId", "==", id);
    await Promise.all(milestones.map((m: any) => this.firebase.delete("milestones", m.id)));

    // Delete campaign
    return this.firebase.delete("campaigns", id);
  }

  async getDonationInfo(campaignId: string, tokenType?: string) {
    const campaign = await this.firebase.getCampaignById(campaignId) as any;

    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }

    if (!campaign.vaultAddress) {
      throw new BadRequestException("Campaign vault not deployed");
    }

    // The vault address is the unique donation address for this campaign
    // All tokens (native, USDC, USDT, etc.) go to the same vault address
    // The contract tracks balances per token internally
    return {
      campaignId,
      vaultAddress: campaign.vaultAddress,
      campaignTitle: campaign.title,
      // Token-specific info will be handled by the frontend
      supportedTokens: [
        { type: "NATIVE", symbol: "ETH", name: "Ethereum", decimals: 18 },
        { type: "USDC", symbol: "USDC", name: "USD Coin", decimals: 6 },
        { type: "USDT", symbol: "USDT", name: "Tether USD", decimals: 6 },
      ],
    };
  }
}

