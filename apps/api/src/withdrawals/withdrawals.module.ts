import { Module } from "@nestjs/common";
import { WithdrawalsService } from "./withdrawals.service";
import { WithdrawalsNewService } from "./withdrawals-new.service";
import { WithdrawalsCryptoService } from "./withdrawals-crypto.service";
import { WithdrawalsController, AdminController } from "./withdrawals.controller";
import { WithdrawalsNewController } from "./withdrawals-new.controller";
import { UploadController } from "./upload.controller";
import { Web3Module } from "../web3/web3.module";
import { EvidenceModule } from "../evidence/evidence.module";
import { QueueModule } from "../queue/queue.module";
import { PaymentsModule } from "../payments/payments.module";
import { FirebaseModule } from "../firebase/firebase.module";
import { CryptoModule } from "../crypto/crypto.module";

@Module({
  imports: [
    Web3Module,
    EvidenceModule,
    QueueModule,
    PaymentsModule,
    FirebaseModule,
    CryptoModule,
  ],
  controllers: [WithdrawalsController, AdminController, UploadController],
  providers: [WithdrawalsService, WithdrawalsNewService, WithdrawalsCryptoService],
  exports: [WithdrawalsService, WithdrawalsNewService, WithdrawalsCryptoService],
})
export class WithdrawalsModule {}


