// Vercel serverless function handler
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

let app: NestFastifyApplication;

async function bootstrap() {
  if (!app) {
    const adapter = new FastifyAdapter({
      logger: false,
    });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

    // Register raw body parser for webhook signature verification
    app.getHttpAdapter().getInstance().addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
      try {
        (req as any).rawBody = body;
        done(null, JSON.parse(body as string));
      } catch (err) {
        done(err, undefined);
      }
    });

    // Global validation pipe
    app.useGlobalPipes(
      new (await import("@nestjs/common")).ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      })
    );

    // CORS
    app.enableCors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-razorpay-signature"],
    });

    // Security headers
    app.getHttpAdapter().getInstance().addHook("onRequest", async (request, reply) => {
      reply.header("X-Content-Type-Options", "nosniff");
      reply.header("X-Frame-Options", "DENY");
      reply.header("X-XSS-Protection", "1; mode=block");
    });

    await app.init();
  }
  return app;
}

// Vercel serverless function handler
export default async function handler(req: any, res: any) {
  const app = await bootstrap();
  await app.getHttpAdapter().getInstance().ready();
  app.getHttpAdapter().getInstance().server.emit('request', req, res);
}










