import { Module } from "@nestjs/common";
import { QueueService } from "./queue.service";

/**
 * QueueModule - Stub module (Redis/BullMQ removed)
 * QueueService is now a no-op service
 */
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}


