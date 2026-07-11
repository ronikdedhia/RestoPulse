import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { connectDB, disconnectDB } from './db/client';
import { initQueues, scheduleDailyCron, scheduleWeeklyDigest } from './queues';
import { startWorkers } from './workers';
import restaurantsRouter from './routes/restaurants.route';
import reviewsRouter from './routes/reviews.route';
import insightsRouter from './routes/insights.route';
import jobsRouter from './routes/jobs.route';
import authRouter from './routes/auth.route';

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '10mb' }));

const globalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: config.nodeEnv });
});

app.use('/api/restaurants', restaurantsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/auth', authRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

async function bootstrap() {
  try {
    await connectDB();
    await initQueues();
    startWorkers();
    await scheduleDailyCron();
    await scheduleWeeklyDigest();

    const server = app.listen(config.port, () => {
      logger.info(`RestoPulse API ready — port ${config.port} | env=${config.nodeEnv}`);
    });

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down...');
      server.close();
      await disconnectDB();
      process.exit(0);
    });
  } catch (error) {
    logger.error(`Bootstrap failed: ${error}`);
    process.exit(1);
  }
}

bootstrap();
