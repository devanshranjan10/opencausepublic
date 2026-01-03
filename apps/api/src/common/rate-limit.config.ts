import { ThrottlerModuleOptions } from "@nestjs/throttler";

/**
 * Rate Limiting Configuration
 * 
 * Provides rate limits for different endpoints
 */
export const rateLimitConfig: ThrottlerModuleOptions = [
  {
    name: "default",
    ttl: 60000, // 1 minute
    limit: 100, // 100 requests per minute
  },
  {
    name: "strict",
    ttl: 60000, // 1 minute
    limit: 20, // 20 requests per minute (for payment intents)
  },
  {
    name: "auth",
    ttl: 60000, // 1 minute
    limit: 10, // 10 requests per minute (for auth endpoints)
  },
];

/**
 * Rate limit decorator options
 */
export const RateLimitOptions = {
  default: { limit: 100, ttl: 60000 },
  strict: { limit: 20, ttl: 60000 },
  auth: { limit: 10, ttl: 60000 },
};






