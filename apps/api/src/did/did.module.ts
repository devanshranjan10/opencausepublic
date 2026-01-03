import { Module } from "@nestjs/common";
import { DIDService } from "./did.service";

@Module({
  providers: [DIDService],
  exports: [DIDService],
})
export class DIDModule {}


