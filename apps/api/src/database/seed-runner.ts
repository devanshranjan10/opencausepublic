import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { FirebaseService } from "../firebase/firebase.service";
import { seedDatabase } from "./seed";
import * as admin from "firebase-admin";

async function bootstrap() {
  // Initialize Firebase manually for seed script
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.FIREBASE_PROJECT_ID || "opencausein";
  
  if (serviceAccount && !admin.apps.length) {
    try {
      const serviceAccountJson = typeof serviceAccount === 'string' 
        ? JSON.parse(serviceAccount) 
        : serviceAccount;
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountJson),
        projectId,
      });
    } catch (error) {
      console.error("Failed to initialize Firebase:", error);
      process.exit(1);
    }
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const firebase = app.get(FirebaseService);
  
  try {
    await seedDatabase(firebase);
    console.log("✅ Database seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
