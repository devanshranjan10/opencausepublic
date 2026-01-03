import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { DIDModule } from "../did/did.module";
import { KYCModule } from "../kyc/kyc.module";

@Module({
  imports: [DIDModule, KYCModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}


