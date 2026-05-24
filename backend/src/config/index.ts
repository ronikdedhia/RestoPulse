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
    url: process.env['REDIS_URL'] ?? '',
    host: optional('REDIS_HOST', 'localhost'),
    port: parseInt(optional('REDIS_PORT', '6379'), 10),
    upstashRestUrl: process.env['UPSTASH_REDIS_REST_URL'] ?? '',
    upstashRestToken: process.env['UPSTASH_REDIS_REST_TOKEN'] ?? '',
  },

  telegram: {
    token: optional('TELEGRAM_ACCESS_TOKEN', ''),
    chatId: optional('TELEGRAM_CHAT_ID', ''),
    channelId: optional('TELEGRAM_CHANNEL_ID', ''),
    channelName: optional('TELEGRAM_CHANNEL_NAME', ''),
  },

  clerk: {
    publishableKey: optional('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', ''),
    secretKey: optional('CLERK_SECRET_KEY', ''),
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

  sendgrid: {
    apiKey: optional('SENDGRID_EMAIL_API_KEY', ''),
    fromEmail: optional('SENDGRID_FROM_EMAIL', 'noreply@restopulse.com'),
    fromName: optional('SENDGRID_FROM_NAME', 'RestoPulse'),
    newsletterSendTime: optional('NEWSLETTER_SEND_TIME', '02:30'),
  },

  backendUrl: optional('BACKEND_URL', 'http://localhost:3001'),

  huggingFace: {
    apiKey: optional('HUGGING_FACE_API_KEY', ''),
  },

  elevenLabs: {
    apiKey: optional('ELEVEN_LABS_API_KEY', ''),
  },
} as const;
