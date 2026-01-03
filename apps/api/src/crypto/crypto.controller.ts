import { Controller, Get, Post, Body, Param, Query } from "@nestjs/common";
import { CryptoAddressService } from "./crypto-address.service";
import { CryptoVerificationService } from "./crypto-verification.service";

@Controller("crypto")
export class CryptoController {
  constructor(
    private cryptoAddressService: CryptoAddressService,
    private cryptoVerificationService: CryptoVerificationService
  ) {}

  @Get("supported")
  getSupportedCryptos() {
    return this.cryptoAddressService.getSupportedCryptos();
  }

  @Post("donation-address")
  async generateDonationAddress(
    @Body() body: { campaignId: string; crypto: string; blockchain?: string; amount?: string }
  ) {
    return this.cryptoAddressService.generateDonationAddress(
      body.campaignId,
      body.crypto,
      body.blockchain,
      body.amount
    );
  }
  
  @Get("grouped")
  getCryptosGrouped() {
    return this.cryptoAddressService.getCryptosGrouped();
  }

  @Get("donation-address/:id")
  async getDonationAddress(@Param("id") id: string) {
    return this.cryptoAddressService.getDonationAddress(id);
  }

  @Post("donation-address/:id/verify")
  async verifyDonation(
    @Param("id") id: string,
    @Body() body: { txHash: string }
  ) {
    // Get donation address
    const donationAddress = await this.cryptoAddressService.getDonationAddress(id);
    if (!donationAddress) {
      return { success: false, error: "Donation address not found" };
    }

    // Verify transaction on blockchain
    const verification = await this.cryptoVerificationService.verifyTransaction(
      body.txHash,
      (donationAddress as any).crypto,
      (donationAddress as any).amount,
      (donationAddress as any).address
    );

    if (!verification.verified) {
      return { success: false, error: verification.error || "Transaction verification failed" };
    }

    // Update donation address status
    await this.cryptoAddressService.updateDonationAddressStatus(
      id,
      "CONFIRMED",
      body.txHash
    );

    return {
      success: true,
      message: "Donation verified",
      verification,
    };
  }
}








