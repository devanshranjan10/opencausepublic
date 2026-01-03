import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";
import { initSentry } from "./common/sentry.config";

// Initialize Sentry early (before app bootstrap)
initSentry(
  process.env.SENTRY_DSN,
  process.env.NODE_ENV || "development"
);

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const isProduction = process.env.NODE_ENV === "production";

  const adapter = new FastifyAdapter({
    logger: isProduction ? false : true, // Disable Fastify logger in production, use NestJS logger
    bodyLimit: 50 * 1024 * 1024, // 50MB limit for KYC submissions with base64 images
  });

  // Enable raw body for webhook signature verification
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter
  );

  // Multipart handling is done manually in UploadController using busboy
  // Skipping @fastify/multipart registration due to version compatibility

  // Register a content type parser for multipart/form-data
  // This prevents Fastify from rejecting with 415 error
  // The controller will access the raw stream via req.raw
  const fastifyInstance = app.getHttpAdapter().getInstance();
  
  // Accept multipart content types without parsing (controller uses busboy on req.raw)
  fastifyInstance.addContentTypeParser(/^multipart\//i, (request, payload, done) => {
    // Just acknowledge the content type - don't parse it
    // The raw stream is still available in req.raw for busboy
    done(null);
  });

  // Register raw body parser for webhook routes only
  // Only capture raw body for webhook endpoints to avoid interfering with normal JSON parsing
  fastifyInstance.addHook('onRequest', async (request, reply) => {
    // Only capture raw body for webhook routes (Razorpay webhook)
    const isWebhookRoute = request.url.includes('/payments/razorpay/webhook');
    if (isWebhookRoute && request.headers['content-type']?.includes('application/json')) {
      const chunks: Buffer[] = [];
      request.raw.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.raw.on('end', () => {
        (request as any).rawBody = Buffer.concat(chunks).toString('utf8');
      });
    }
  });

  // Global validation pipe - stricter in production
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: isProduction, // Strict in production
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: isProduction, // Hide error details in production
    })
  );

  // CORS configuration - production-ready
  const allowedOrigins = isProduction
    ? [process.env.FRONTEND_URL].filter(Boolean) // Only allow configured frontend URL
    : [
        process.env.FRONTEND_URL || "http://localhost:3000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin) || !isProduction) {
        callback(null, true);
      } else {
        logger.warn(`CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Security headers
  app.getHttpAdapter().getInstance().addHook("onRequest", async (request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("X-XSS-Protection", "1; mode=block");
    reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    if (isProduction) {
      reply.header("Content-Security-Policy", "default-src 'self'");
    }
  });

  // For regular server deployment, listen on port
  const port = parseInt(process.env.PORT || "4000", 10);
  await app.listen(port, "0.0.0.0");
  logger.log(`🚀 API running on http://0.0.0.0:${port}`);
  
  logger.log(`📦 Environment: ${process.env.NODE_ENV || "development"}`);
  if (isProduction) {
    logger.log(`🔒 Production mode enabled - strict validation and security headers active`);
  }
}

// Only run bootstrap if not in Vercel (Vercel uses api/index.ts as entry point)
if (!process.env.VERCEL) {
  bootstrap().catch((error) => {
    console.error("Failed to start application:", error);
    process.exit(1);
  });
}
