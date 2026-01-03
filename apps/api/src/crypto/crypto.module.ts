import { Module } from "@nestjs/common";
import { CryptoAddressService } from "./crypto-address.service";
import { CryptoVerificationService } from "./crypto-verification.service";
import { CryptoVerifyService } from "./crypto-verify.service";
import { HDWalletService } from "./hd-wallet.service";
import { PaymentIntentsService } from "./payment-intents.service";
import { FxRateService } from "./fx-rate.service";
import { CampaignPublicService } from "./campaign-public.service";
import { CryptoController } from "./crypto.controller";
import { CryptoNewController } from "./crypto-new.controller";
import { PricesController } from "./prices.controller";
import { FirebaseModule } from "../firebase/firebase.module";

@Module({
  imports: [FirebaseModule],
  providers: [
    HDWalletService,
    CryptoAddressService,
    CryptoVerificationService,
    CryptoVerifyService,
    PaymentIntentsService,
    FxRateService,
    CampaignPublicService,
  ],
  controllers: [CryptoController, CryptoNewController, PricesController],
  exports: [
    CryptoAddressService,
    CryptoVerificationService,
    CryptoVerifyService,
    HDWalletService,
    PaymentIntentsService,
    FxRateService,
    CampaignPublicService,
  ],
})
export class CryptoModule {}

