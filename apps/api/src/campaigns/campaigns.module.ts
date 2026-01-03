import { Module } from "@nestjs/common";
import { CampaignsService } from "./campaigns.service";
import { CampaignBalanceService } from "./campaign-balance.service";
import { CampaignsController } from "./campaigns.controller";
import { Web3Module } from "../web3/web3.module";
import { CryptoModule } from "../crypto/crypto.module";
import { FirebaseModule } from "../firebase/firebase.module";
import { KYCModule } from "../kyc/kyc.module";

@Module({
  imports: [Web3Module, CryptoModule, FirebaseModule, KYCModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignBalanceService],
  exports: [CampaignsService, CampaignBalanceService],
})
export class CampaignsModule {}


