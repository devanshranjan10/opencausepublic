import { Module } from "@nestjs/common";
import { EvidenceService } from "./evidence.service";
import { EvidenceController } from "./evidence.controller";
import { QueueModule } from "../queue/queue.module";

@Module({
  imports: [QueueModule],
  controllers: [EvidenceController],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}


