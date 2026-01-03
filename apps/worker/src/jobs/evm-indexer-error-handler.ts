/**
 * Error handling wrapper for worker jobs
 * Captures errors to Sentry for monitoring
 */

import { Job } from "bullmq";

let Sentry: any;
try {
  Sentry = require("@sentry/node");
} catch {
  // Sentry optional
}

export function withErrorTracking<T>(
  jobProcessor: (job: Job, ...args: any[]) => Promise<T>
) {
  return async (job: Job, ...args: any[]): Promise<T> => {
    try {
      return await jobProcessor(job, ...args);
    } catch (error: any) {
      if (Sentry) {
        Sentry.captureException(error, {
          tags: {
            queue: job.queueName,
            jobId: job.id,
            jobName: job.name,
          },
          extra: {
            jobData: job.data,
            attemptsMade: job.attemptsMade,
          },
        });
      }
      
      console.error(`[Worker Error] ${job.queueName}:${job.id}`, error);
      throw error;
    }
  };
}






