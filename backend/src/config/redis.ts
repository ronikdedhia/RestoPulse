import IORedis from 'ioredis';
import { config } from './index';

// BullMQ workers use blocking commands — each Queue/Worker needs its own connection
export function createRedis(): IORedis {
  return new IORedis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export const redis = createRedis();
