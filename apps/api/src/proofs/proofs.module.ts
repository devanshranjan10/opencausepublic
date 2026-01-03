import { Module } from "@nestjs/common";
import { ProofsService } from "./proofs.service";
import { ProofsController } from "./proofs.controller";
import { FirebaseModule } from "../firebase/firebase.module";

@Module({
  imports: [FirebaseModule],
  controllers: [ProofsController],
  providers: [ProofsService],
  exports: [ProofsService],
})
export class ProofsModule {}

