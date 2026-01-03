import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  beforeSend(event, hint) {
    // Filter out non-critical client errors in production
    if (process.env.NODE_ENV === "production" && event.level === "warning") {
      return null;
    }
    return event;
  },
});






