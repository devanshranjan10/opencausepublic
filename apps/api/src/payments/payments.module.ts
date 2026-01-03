import { Module, forwardRef } from "@nestjs/common";
import { RazorpayService } from "./razorpay.service";
import { PaymentsController } from "./payments.controller";
import { FirebaseModule } from "../firebase/firebase.module";
import { DonationsModule } from "../donations/donations.module";
import { Web3Module } from "../web3/web3.module";
import { QueueModule } from "../queue/queue.module";

@Module({
  imports: [
    FirebaseModule,
    forwardRef(() => DonationsModule), // Use forwardRef to avoid circular dependency
    Web3Module,
    QueueModule,
  ],
  controllers: [PaymentsController],
  providers: [RazorpayService],
  exports: [RazorpayService],
})
export class PaymentsModule {}










