import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { FirebaseModule } from "../firebase/firebase.module";
import { QueueModule } from "../queue/queue.module";

@Module({
  imports: [FirebaseModule, QueueModule],
  controllers: [HealthController],
})
export class HealthModule {}

