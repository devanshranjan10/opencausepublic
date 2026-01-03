import { Module, forwardRef } from "@nestjs/common";
import { EventService } from "./event.service";
import { DonationAllocationService } from "./donation-allocation.service";
import { MilestoneService } from "./milestone.service";
import { DonationsEnhancedService } from "./donations-enhanced.service";
import { TransparencyController } from "./transparency.controller";
import { DonationsModule } from "../donations/donations.module";

@Module({
  controllers: [TransparencyController],
  imports: [forwardRef(() => DonationsModule)],
  providers: [
    EventService,
    DonationAllocationService,
    MilestoneService,
    DonationsEnhancedService,
  ],
  exports: [
    EventService,
    DonationAllocationService,
    MilestoneService,
    DonationsEnhancedService,
  ],
})
export class TransparencyModule {}
