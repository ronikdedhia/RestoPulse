import IORedis from 'ioredis';
import { config } from './index';

// BullMQ workers use blocking commands — each Queue/Worker needs its own connection.
// Priority: UPSTASH_REDIS_REST_URL > REDIS_URL > host/port (localhost dev)
export function createRedis(): IORedis {
  if (config.redis.upstashRestUrl && config.redis.upstashRestToken) {
    const hostname = new URL(config.redis.upstashRestUrl).hostname;
    const url = `rediss://:${config.redis.upstashRestToken}@${hostname}:6379`;
    return new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: {},
    });
  }

  if (config.redis.url) {
    return new IORedis(config.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: config.redis.url.startsWith('rediss://') ? {} : undefined,
    });
  }

  return new IORedis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export const redis = createRedis();
