import { Worker } from 'bullmq';
import { logger } from './logger';

const QUOTA_ERROR_MARKER = 'max requests limit exceeded';
const COOLDOWN_MS = 5 * 60 * 1000;

// Upstash rejects every command once the monthly quota is hit. BullMQ's
// blocking job-fetch loop has no backoff for command-level errors, so without
// this it retries as fast as the round-trip allows — hammering Upstash and
// spamming logs until the quota resets. Pausing the worker stops the
// blocking-pop calls entirely for the cooldown window.
export function attachRedisQuotaGuard(worker: Worker, name: string) {
  let cooling = false;

  worker.on('error', (err) => {
    if (!err.message.includes(QUOTA_ERROR_MARKER)) {
      logger.error(`[${name}] Worker error: ${err.message}`);
      return;
    }

    if (cooling) return;
    cooling = true;

    logger.error(`[${name}] Redis quota exceeded — pausing worker for ${COOLDOWN_MS / 60_000}min`);
    worker.pause();

    setTimeout(() => {
      cooling = false;
      worker.resume();
      logger.info(`[${name}] Resuming after quota cooldown`);
    }, COOLDOWN_MS);
  });
}
