import dotenv from 'dotenv';

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3001'), 10),

  databaseUrl: required('DATABASE_URL'),
  databaseAuthToken: optional('DATABASE_AUTH_TOKEN', ''),

  redis: {
    host: optional('REDIS_HOST', 'localhost'),
    port: parseInt(optional('REDIS_PORT', '6379'), 10),
  },

  apify: {
    token: required('APIFY_TOKEN'),
    actorId: optional('APIFY_ACTOR_ID', 'compass~google-maps-reviews-scraper'),
    zomatoActorId: optional('APIFY_ZOMATO_ACTOR_ID', 'emastra~zomato-reviews-scraper'),
  },

  groq: {
    apiKey: required('GROQ_API_KEY'),
    model: optional('GROQ_MODEL', 'llama-3.1-8b-instant'),
  },

  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:3000'),

  rateLimitWindowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
  rateLimitMaxRequests: parseInt(optional('RATE_LIMIT_MAX_REQUESTS', '100'), 10),

  workers: {
    scrapeConcurrency: parseInt(optional('SCRAPE_CONCURRENCY', '2'), 10),
    insightsConcurrency: parseInt(optional('INSIGHTS_CONCURRENCY', '3'), 10),
    maxReviewsPerRestaurant: parseInt(optional('MAX_REVIEWS_PER_RESTAURANT', '10'), 10),
    maxZomatoReviewsPerRestaurant: parseInt(optional('MAX_ZOMATO_REVIEWS_PER_RESTAURANT', '5'), 10),
  },
} as const;
