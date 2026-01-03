import { Module } from "@nestjs/common";
import { KYCService } from "./kyc.service";
import { KYCController } from "./kyc.controller";

@Module({
  controllers: [KYCController],
  providers: [KYCService],
  exports: [KYCService],
})
export class KYCModule {}


