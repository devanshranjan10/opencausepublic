import { Module, forwardRef } from "@nestjs/common";
import { DonationsService } from "./donations.service";
import { DonationsController } from "./donations.controller";
import { Web3Module } from "../web3/web3.module";
import { QueueModule } from "../queue/queue.module";
import { TransparencyModule } from "../transparency/transparency.module";

@Module({
  imports: [Web3Module, QueueModule, forwardRef(() => TransparencyModule)],
  controllers: [DonationsController],
  providers: [DonationsService],
  exports: [DonationsService],
})
export class DonationsModule {}


