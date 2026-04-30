# RestoPulse

AI-powered restaurant review analytics platform for Mumbai. Scrapes reviews from Google Maps and Zomato via Apify, processes them with GROQ (Llama 3.1) to generate PM-level actionable insights, and displays them on a Next.js dashboard.

---

## Architecture

```
RestoPulse/
├── backend/          Express.js API + BullMQ workers
├── frontend/         Next.js 14 dashboard
└── docker-compose.yml
```

### Tech Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + Express 5 + TypeScript |
| Frontend | Next.js 14 (App Router) + Tailwind CSS + Shadcn/UI |
| Database | Turso (libsql) + Prisma ORM (driver adapter) |
| Job Queue | BullMQ + Redis |
| Scraping | Apify (Google Maps + Zomato scrapers) |
| AI / Insights | GROQ (`llama-3.1-8b-instant`) |
| Charts | Recharts |
| Data Fetching | TanStack Query (React Query) |

---

## Data Flow

```
1. Daily cron fires (configurable, default: every minute in dev / 11:30 PM IST in prod)
        ↓
2. For each active restaurant:
   - If googleMapsUrl set  → queue Google scrape job  (max 10 reviews/day, today only)
   - If zomatoUrl set      → queue Zomato scrape job  (max 5 reviews/day, today only)
        ↓
3. Each scrapeWorker job → calls Apify actor for its source
        ↓
4. Reviews upserted into Turso (deduplicated by externalId, tagged by source)
        ↓
5. insightsWorker calls GROQ with combined reviews from ALL sources
        ↓
6. GROQ returns 5–6 cross-source PM-level insights per restaurant
        ↓
7. Insights saved to Turso (old ones replaced)
        ↓
8. Dashboard auto-refreshes every 30s
```

---

## Database Schema

### `Restaurant`

| Field | Type | Notes |
|---|---|---|
| id | cuid | Primary key |
| name | String | Restaurant name |
| address | String | Full address |
| googleMapsUrl | String? | Unique — Google Maps scraper input |
| zomatoUrl | String? | Unique — Zomato scraper input |
| placeId | String? | Google Place ID (from Apify) |
| rating | Float? | Avg rating from Google |
| totalReviews | Int? | Total review count |
| cuisine | String? | Cuisine type |
| priceLevel | String? | e.g. "$$$" |
| imageUrl | String? | Restaurant photo URL |
| lastScraped | DateTime? | Last successful scrape timestamp |
| isActive | Boolean | Soft delete flag |

> A restaurant can have one or both URLs. Insights are generated from the combined review pool across all sources.

### `Review`

| Field | Type | Notes |
|---|---|---|
| id | cuid | Primary key |
| restaurantId | FK → Restaurant | |
| externalId | String? | Platform review ID — deduplication key |
| reviewerName | String? | |
| rating | Int | 1–5 stars |
| text | String? | Review body |
| reviewDate | DateTime? | When the review was written |
| language | String? | Detected language |
| source | String | `google_maps` or `zomato` |

### `ActionableInsight`

| Field | Type | Notes |
|---|---|---|
| id | cuid | Primary key |
| restaurantId | FK → Restaurant | |
| category | String | food_quality / service / ambiance / pricing / hygiene / staff / wait_time / overall |
| insight | String | Observation grounded in review evidence |
| priority | String | high / medium / low |
| overallSentiment | String | positive / negative / mixed / neutral |
| evidenceCount | Int | Number of reviews supporting this insight |
| keyThemes | String | JSON-serialized string[] |
| suggestedAction | String? | Concrete action for restaurant owner/PM |
| impactScore | Float? | 0.0–1.0 |
| reviewPeriod | String? | JSON-serialized { from, to } |

### `ScrapeJob`

| Field | Type | Notes |
|---|---|---|
| id | cuid | Primary key |
| restaurantId | FK → Restaurant? | |
| status | String | pending / running / completed / failed |
| jobType | String | scrape / insights |
| bullJobId | String? | BullMQ job ID |
| reviewsFound | Int | Reviews scraped or insights generated |
| error | String? | Error message if failed |

---

## API Reference

### Restaurants
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/restaurants` | List all active restaurants |
| GET | `/api/restaurants/:id` | Get restaurant + top insights |
| POST | `/api/restaurants` | Add a restaurant |

**POST `/api/restaurants` body:**
```json
{
  "name": "Bademiya",
  "address": "Colaba, Mumbai",
  "googleMapsUrl": "https://maps.google.com/?cid=...",
  "zomatoUrl": "https://www.zomato.com/mumbai/bademiya-colaba/reviews",
  "cuisine": "Mughlai"
}
```
At least one of `googleMapsUrl` or `zomatoUrl` is required.

### Reviews
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/reviews/restaurant/:id` | Get paginated reviews |
| GET | `/api/reviews/restaurant/:id/stats` | Rating distribution + totals |

### Insights
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/insights` | Summary — all restaurants + top 3 insights each |
| GET | `/api/insights/restaurant/:id` | All insights for a restaurant |
| POST | `/api/insights/restaurant/:id/generate` | Manually trigger insight generation |

### Jobs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/jobs` | List recent jobs (filterable by status / restaurantId) |
| GET | `/api/jobs/queue-stats` | Live BullMQ queue counts |
| GET | `/api/jobs/:id` | Get single job |

---

## Local Development

### Prerequisites
- Node.js 20+
- Docker (for Redis only — database is Turso cloud)
- Turso account + database created

### 1. Start Redis
```bash
docker compose up redis -d
```

### 2. Backend setup
```bash
cd backend
cp .env.example .env
# Fill in: GROQ_API_KEY, APIFY_TOKEN, DATABASE_URL, DATABASE_AUTH_TOKEN
npm install
npm run db:migrate-turso   # push schema to Turso
npm run dev
```

### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev
```

- Dashboard: http://localhost:3000
- API: http://localhost:3001
- Health: http://localhost:3001/health

---

## Environment Variables

### Backend (`backend/.env`)
```
NODE_ENV=development
PORT=3001

# Database (Turso)
DATABASE_URL=libsql://<your-db>.turso.io
DATABASE_AUTH_TOKEN=<your-turso-token>
DATABASE_URL_LOCAL=file:./prisma/dev.db    # Prisma CLI only

# GROQ
GROQ_API_KEY=<your-key>
GROQ_MODEL=llama-3.1-8b-instant

# Apify
APIFY_TOKEN=<your-token>
APIFY_ACTOR_ID=compass~google-maps-reviews-scraper     # optional override
APIFY_ZOMATO_ACTOR_ID=emastra~zomato-reviews-scraper   # optional override

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Scraping limits (keep these low to control Apify costs)
MAX_REVIEWS_PER_RESTAURANT=10
MAX_ZOMATO_REVIEWS_PER_RESTAURANT=5

# App
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Cron

A BullMQ repeatable job (`daily-scrape-all`) registers on startup. For each active restaurant it queues:
- A Google scrape job if `googleMapsUrl` is set (max 10 reviews, today only)
- A Zomato scrape job if `zomatoUrl` is set (max 5 reviews, today only)

Both jobs feed reviews into the same restaurant record. Insights are then generated from the combined pool — cross-source patterns surface in a single insight set.

The cron pattern is set in `backend/src/queues/index.ts` (`CRON_PATTERN`). Default in dev: `* * * * *` (every minute). Change to `30 17 * * *` for 11:30 PM IST in production.

The job is idempotent — restarting the server does not create duplicates.

---

## Adding a Restaurant

Use the dashboard UI (`+ Add Restaurant`) or the API directly:

```bash
curl -X POST http://localhost:3001/api/restaurants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bademiya Colaba",
    "address": "Colaba, Mumbai",
    "googleMapsUrl": "https://maps.google.com/?cid=...",
    "zomatoUrl": "https://www.zomato.com/mumbai/bademiya-colaba/reviews"
  }'
```

---

## Project Structure

```
backend/src/
├── config/         env config + redis client factory
├── db/             Prisma + libsql adapter client
├── queues/         BullMQ queue definitions + daily cron setup
├── workers/        scrape.worker + insights.worker
├── services/       apify / groq / restaurant / review / insight
├── routes/         restaurants / reviews / insights / jobs
├── types/          Zod schemas + TypeScript interfaces
├── utils/          logger
└── index.ts        Express app bootstrap

backend/prisma/
├── schema.prisma         Prisma schema (sqlite provider + driverAdapters)
├── seed.ts               Restaurant seed script
├── migrate-turso.ts      DDL migration script for Turso (idempotent, versioned)
└── cleanup-old-db.ts     One-time cleanup helper

frontend/src/
├── app/
│   ├── dashboard/           Restaurant grid + Add Restaurant button
│   ├── dashboard/[id]/      Per-restaurant insights + rating chart
│   └── dashboard/add/       Add restaurant form (Google + Zomato URLs)
├── components/dashboard/
│   ├── RestaurantCard        Card with top insights + source badges (G/Z)
│   ├── InsightPanel          Colour-coded insight with themes + action
│   ├── QueueStats            Live BullMQ activity banner
│   └── RatingChart           Bar chart — rating distribution
└── lib/
    ├── api.ts     Axios client + fetch/mutation helpers
    └── utils.ts   cn() Tailwind class merger
```

---

## Build Status

- [x] Monorepo scaffold — backend + frontend + docker-compose
- [x] Turso schema — Restaurant, Review, ActionableInsight, ScrapeJob
- [x] BullMQ queues — `scrape` + `insights` (separate Redis connections per worker)
- [x] Workers — scrapeWorker (Apify → Turso) + insightsWorker (Turso → GROQ → Turso)
- [x] Dual-source scraping — Google Maps + Zomato per restaurant
- [x] Cross-source insights — GROQ sees combined review pool
- [x] Services — apify, groq, restaurant, review, insight
- [x] REST API — restaurants, reviews, insights, jobs
- [x] Next.js 14 dashboard — restaurant grid + per-restaurant detail page
- [x] Add Restaurant form — supports both Google Maps + Zomato URLs
- [x] Daily cron via BullMQ repeatable jobs (today-only reviews, hard caps per source)
- [x] Restaurant metadata auto-updated on each Google scrape
- [x] Source badges on dashboard cards (G / Z)
- [x] `.gitignore`, `.env.example` files
