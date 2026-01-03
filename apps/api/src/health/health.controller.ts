import { Controller, Get } from "@nestjs/common";
import { FirebaseService } from "../firebase/firebase.service";

@Controller("health")
export class HealthController {
  constructor(private firebase: FirebaseService) {}

  @Get()
  async check() {
    const checks = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      checks: {
        database: "unknown",
      },
    };

    // Check Firebase
    try {
      await this.firebase.firestore.collection("_health").doc("check").get();
      checks.checks.database = "healthy";
    } catch (error) {
      checks.checks.database = "unhealthy";
      checks.status = "degraded";
    }

    return checks;
  }

  @Get("ready")
  async readiness() {
    const checks = {
      database: false,
    };

    // Firebase readiness
    try {
      await this.firebase.firestore.collection("_health").doc("check").get();
      checks.database = true;
    } catch (error) {
      throw new Error("Database not ready");
    }

    return { status: "ready", checks };
  }

  @Get("live")
  liveness() {
    return { status: "alive", timestamp: new Date().toISOString() };
  }
}

