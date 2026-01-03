import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { AppController } from "./app.controller";
import { FirebaseModule } from "./firebase/firebase.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { DonationsModule } from "./donations/donations.module";
import { WithdrawalsModule } from "./withdrawals/withdrawals.module";
import { EvidenceModule } from "./evidence/evidence.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { Web3Module } from "./web3/web3.module";
import { QueueModule } from "./queue/queue.module";
import { HealthModule } from "./health/health.module";
import { StatsModule } from "./stats/stats.module";
import { PaymentsModule } from "./payments/payments.module";
import { CryptoModule } from "./crypto/crypto.module";
import { TransparencyModule } from "./transparency/transparency.module";
import { ProofsModule } from "./proofs/proofs.module";
import { KYCModule } from "./kyc/kyc.module";

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || "development"}`,
        ".env",
      ],
    }),
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: parseInt(process.env.RATE_LIMIT_TTL || "60000"),
        limit: parseInt(process.env.RATE_LIMIT_MAX || "100"),
      },
      {
        name: "strict",
        ttl: 60000,
        limit: 20, // Stricter limit for payment intents
      },
      {
        name: "auth",
        ttl: 60000,
        limit: 10, // Stricter limit for auth endpoints
      },
    ]),
    FirebaseModule,
    AuthModule,
    UsersModule,
    CampaignsModule,
    DonationsModule,
    WithdrawalsModule,
    EvidenceModule,
    NotificationsModule,
    Web3Module,
    QueueModule,
    HealthModule,
    StatsModule,
        PaymentsModule,
        CryptoModule,
        TransparencyModule,
        ProofsModule,
        KYCModule,
      ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}


