/**
 * Sentry Error Tracking Configuration
 * 
 * Provides error tracking and monitoring
 */

import * as Sentry from "@sentry/node";

export function initSentry(dsn?: string, environment?: string) {
  const sentryDsn = dsn || process.env.SENTRY_DSN;
  
  if (!sentryDsn) {
    console.warn("[Sentry] DSN not provided, error tracking disabled");
    return;
  }

  try {
    Sentry.init({
      dsn: sentryDsn as string,
      environment: environment || process.env.NODE_ENV || "development",
      integrations: [
        // Profiling integration can be added later if needed
      ],
      // Performance Monitoring
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      // Profiling
      profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      // Filter out health checks and noise
      beforeSend(event, hint) {
        // Filter out health check endpoints
        if (event.request?.url?.includes("/health")) {
          return null;
        }
        return event;
      },
    } as any);

    console.log("[Sentry] Error tracking initialized");
  } catch (error) {
    console.error("[Sentry] Failed to initialize:", error);
  }
}

// Export Sentry for use in worker jobs
export { Sentry };
