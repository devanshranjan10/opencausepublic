// Vercel serverless function entry point
import "reflect-metadata";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import express from "express";
import { ValidationPipe, Logger } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { initSentry } from "../src/common/sentry.config";

// Initialize Sentry early (before app bootstrap)
try {
  initSentry(
    process.env.SENTRY_DSN,
    process.env.NODE_ENV || "development"
  );
} catch (err) {
  console.warn("[Sentry] Failed to initialize:", err);
}

const server = express();

let ready = false;
let boot: Promise<void> | null = null;
let bootError: Error | null = null;

async function initOnce() {
  if (ready) return;
  if (bootError) throw bootError;
  if (!boot) {
    boot = (async () => {
      try {
        const logger = new Logger("Bootstrap");
        const isProduction = process.env.NODE_ENV === "production";

        console.log("[Vercel] Starting NestJS initialization...");

        const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
          logger: isProduction ? ["error", "warn"] : ["error", "warn", "log"],
        });

        console.log("[Vercel] NestFactory created");

        // Global validation pipe
        app.useGlobalPipes(
          new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: isProduction,
            transform: true,
            transformOptions: {
              enableImplicitConversion: true,
            },
            disableErrorMessages: isProduction,
          })
        );

        // CORS configuration
        const allowedOrigins = isProduction
          ? [
              "https://opencause.world",
              "https://www.opencause.world",
              process.env.FRONTEND_URL,
              process.env.NEXT_PUBLIC_FRONTEND_URL,
            ].filter(Boolean)
          : [
              process.env.FRONTEND_URL || "http://localhost:3000",
              process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000",
              "http://localhost:3000",
              "http://127.0.0.1:3000",
            ];

        app.enableCors({
          origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, Postman, etc.)
            if (!origin) {
              return callback(null, true);
            }
            
            // In development, allow all origins
            if (!isProduction) {
              return callback(null, true);
            }
            
            // Check if origin is in allowed list
            if (allowedOrigins.includes(origin)) {
              return callback(null, true);
            }
            
            // Log and allow for now (can be made stricter later)
            logger.warn(`CORS request from: ${origin}, allowing`);
            callback(null, true);
          },
          credentials: true,
          methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
          allowedHeaders: ["Content-Type", "Authorization", "x-razorpay-signature"],
        });

        // Security headers middleware (Express)
        server.use((req, res, next) => {
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("X-Frame-Options", "DENY");
          res.setHeader("X-XSS-Protection", "1; mode=block");
          if (isProduction) {
            res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
            res.setHeader("Content-Security-Policy", "default-src 'self'");
          }
          next();
        });

        // Raw body parser for webhook signature verification
        // Must be configured BEFORE multipart check to avoid parsing multipart as JSON
        try {
          const bodyParser = require("body-parser");
          
          // Skip body parsing for multipart/form-data - controllers will handle it with busboy
          server.use((req: any, res: any, next: any) => {
            const contentType = req.headers["content-type"] || "";
            if (contentType.includes("multipart/form-data")) {
              // Don't parse body for multipart - let busboy handle it
              return next();
            }
            next();
          });

          // Parse JSON body (only for non-multipart requests)
          server.use(
            bodyParser.json({
              verify: (req: any, res: any, buf: Buffer) => {
                req.rawBody = buf.toString("utf8");
              },
            })
          );
        } catch (err) {
          console.warn("[Vercel] Failed to setup body parser:", err);
        }

        console.log("[Vercel] Calling app.init()...");
        await app.init();
        ready = true;
        console.log("[Vercel] API initialized successfully");
      } catch (error: any) {
        console.error("[Vercel] Initialization failed:");
        console.error("[Vercel] Error name:", error?.name);
        console.error("[Vercel] Error message:", error?.message);
        console.error("[Vercel] Error stack:", error?.stack);
        bootError = error;
        throw error;
      }
    })();
  }
  await boot;
}

// ✅ This is what Vercel needs from api/index.ts
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await initOnce();
    
    // Handle the request through Express
    // Cast to Express types since Express adapter uses Express Response
    const expressReq = req as any;
    const expressRes = res as any;
    
    // Express will handle the request/response, we just need to return the promise
    return new Promise<void>((resolve) => {
      // Track when response is finished
      expressRes.on('finish', () => resolve());
      expressRes.on('close', () => resolve());
      
      // Handle errors
      expressRes.on('error', (err: any) => {
        console.error("[Vercel] Response error:", err);
        resolve();
      });
      
      // Call Express
      server(expressReq, expressRes);
    });
  } catch (error: any) {
    console.error("[Vercel] Handler error:");
    console.error("[Vercel] Error name:", error?.name);
    console.error("[Vercel] Error message:", error?.message);
    console.error("[Vercel] Error stack:", error?.stack);
    
    if (!(res as any).headersSent) {
      res.status(500).json({
        error: "Internal Server Error",
        message: process.env.NODE_ENV === "production" 
          ? "An error occurred" 
          : error?.message || "Unknown error",
      });
    }
  }
}
