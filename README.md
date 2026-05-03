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
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Database | Turso (libsql) + Prisma ORM (driver adapter) |
| Job Queue | BullMQ + Redis (local Docker or Upstash via `REDIS_URL`) |
| Scraping | Apify (Google Maps + Zomato scrapers) |
| AI / Insights | GROQ (`llama-3.1-8b-instant`) |
| Auth | Clerk (`@clerk/nextjs` — manual JWT decode on backend) |
| Email | SendGrid |
| Alerts | Telegram Bot API (real-time velocity + escalation alerts) |
| Charts | Recharts |
| Data Fetching | TanStack Query (React Query) |
| UI | Glassmorphism dark design system (backdrop-blur, frosted glass) |

---

## Data Flow

```
1. Daily cron fires (BullMQ repeatable, configurable pattern)
        ↓
2. For each active restaurant:
   - If googleMapsUrl set  → queue Google scrape job
   - If zomatoUrl set      → queue Zomato scrape job
        ↓
3. scrapeWorker → calls Apify actor
        ↓
4. Reviews upserted into Turso (deduplicated by externalId)
        ↓
5. Post-scrape analytics (non-fatal, each wrapped in try/catch):
   - velocityService.compute()          → daily review counts + spike alerts
   - fakeReviewService.scoreReviews()   → per-review authenticity scoring
   - priceSensitivityService.compute()  → weekly value perception score
   - redFlagService.scan()              → keyword scan for critical reviews (food poisoning, cockroach, etc.)
     → Telegram alert fired immediately on any new red flags
        ↓
6. insightsWorker calls GROQ with combined reviews (all sources)
        ↓
7. Before replacing insights: snapshotCurrentInsights() → InsightSnapshot table
        ↓
8. GROQ returns 5-6 cross-source PM-level insights per restaurant
        ↓
9. Post-insight analytics (non-fatal):
   - groqService.extractDishMentions() → dish NER + sentiment
   - groqService.extractStaffMentions() → staff name NER + sentiment
   - escalationService.check() → persistent issue detection (3+ consecutive weeks)
     → Telegram alert when issue reaches 6 consecutive weeks
   - healthScoreService.compute() → composite 0-100 score (rating/sentiment/velocity/penalties)
        ↓
10. Weekly cron (Monday 8am IST): digestWorker sends SendGrid email to owners
         with insights diff, velocity alerts, dish complaints, staff flags
```

---

## Database Schema

### `Restaurant`

| Field | Type | Notes |
|---|---|---|
| id | cuid | Primary key |
| name | String | |
| address | String | |
| googleMapsUrl | String? | Unique — Google scraper input |
| zomatoUrl | String? | Unique — Zomato scraper input |
| placeId | String? | Google Place ID |
| rating | Float? | Avg rating from Google |
| totalReviews | Int? | Total review count |
| cuisine | String? | |
| priceLevel | String? | e.g. "$$$" |
| imageUrl | String? | |
| lastScraped | DateTime? | Last successful scrape |
| isActive | Boolean | Soft delete flag |
| ownerEmail | String? | Weekly digest recipient |
| digestEnabled | Boolean | Toggle digest on/off |
| unsubscribeToken | String? | Unique — one-click unsubscribe |

### `Review`

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| restaurantId | FK | |
| externalId | String? | Deduplication key |
| reviewerName | String? | |
| rating | Int | 1–5 |
| text | String? | |
| reviewDate | DateTime? | When review was posted |
| sentiment | String? | positive / negative / mixed / neutral |
| language | String? | |
| source | String | `google_maps` or `zomato` |
| isRedFlag | Boolean | `true` if critical keywords detected |
| redFlagWords | String? | Comma-separated matched keywords |

### `ActionableInsight`

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| restaurantId | FK | |
| category | String | food_quality / service / ambiance / pricing / hygiene / staff / wait_time / overall |
| insight | String | Evidence-grounded observation |
| priority | String | high / medium / low |
| overallSentiment | String | positive / negative / mixed / neutral |
| evidenceCount | Int | Reviews supporting this insight |
| keyThemes | String | JSON-serialized string[] |
| suggestedAction | String? | Concrete action |
| impactScore | Float? | 0.0–1.0 |
| reviewPeriod | String? | JSON-serialized { from, to } |

### `InsightSnapshot`

Weekly snapshot of insight scores per restaurant — enables week-over-week diffing.

| Field | Type | Notes |
|---|---|---|
| restaurantId | FK | |
| weekStart | DateTime | Monday of the week (UTC midnight) |
| category | String | |
| impactScore | Float | Snapshot of that week's score |
| priority | String | |

### `DishMention`

Extracted by GROQ NER after each insight generation. Replaced on re-run.

| Field | Type | Notes |
|---|---|---|
| restaurantId | FK | |
| dish | String | Menu item name |
| mentions | Int | Total mention count |
| positiveMentions | Int | |
| negativeMentions | Int | |

### `StaffMention`

First names extracted by GROQ NER with sentiment. Replaced on re-run.

| Field | Type | Notes |
|---|---|---|
| restaurantId | FK | |
| staffName | String | First name only |
| mentions | Int | |
| positiveMentions | Int | |
| negativeMentions | Int | |

### `ReviewVelocity`

Daily review count time-series. Upserted after each scrape.

| Field | Type | Notes |
|---|---|---|
| restaurantId | FK | |
| date | DateTime | Day granularity (unique per restaurant) |
| totalReviews | Int | |
| positiveCount | Int | rating ≥ 4 |
| negativeCount | Int | rating ≤ 2 |
| avgRating | Float? | |

### `VelocityAlert`

Spike alerts computed from ReviewVelocity. Active alerts shown as banners.

| Field | Type | Notes |
|---|---|---|
| restaurantId | FK | |
| alertType | String | `negative_spike` / `positive_spike` |
| severity | String | high / medium / low |
| message | String | Human-readable alert |
| reviewsPerDay | Float | Current window avg |
| baseline | Float | Prior 7-day avg |
| isActive | Boolean | Re-evaluated after each scrape |

### `FakeReviewScore`

Per-review authenticity score. Rule-based — no extra AI calls.

| Field | Type | Notes |
|---|---|---|
| reviewId | FK (unique) | One score per review |
| restaurantId | FK | |
| authenticityScore | Float | 0–1 (lower = more suspicious) |
| flags | String? | JSON-serialized flag string[] |
| isSuspicious | Boolean | score < 0.5 |

**Flags:** `no_text`, `very_short_text`, `short_text`, `rating_text_mismatch_high`, `rating_text_mismatch_low`, `generic_positive`, `no_reviewer_name`, `burst_timing`

### `PriceSensitivity`

Weekly value perception score from keyword scanning. Independent of the `pricing` insight category.

| Field | Type | Notes |
|---|---|---|
| restaurantId | FK | |
| weekStart | DateTime | Unique per restaurant |
| valueScore | Float | 0–1 (higher = better value perception) |
| mentionCount | Int | Reviews with price signals |
| positiveMentions | Int | "worth it", "paisa vasool", "affordable"… |
| negativeMentions | Int | "overpriced", "too costly", "ripoff"… |

### Red Flag fields on `Review`

Critical keyword matches stored directly on the `Review` row — no separate table needed.

**Keywords scanned:** food poisoning, cockroach/roach, hair in food, rude staff, overcharged, double billing/charged, fraud/cheated, rat/mice, insects, vomit, stone in food.

A Telegram alert fires immediately when new red flags are detected in a scrape run.

### `PersistentIssue`

Category appearing in ≥3 of last 4 weekly snapshots — structural problem signal.

| Field | Type | Notes |
|---|---|---|
| restaurantId | FK | |
| category | String | Unique per restaurant |
| weeksSeen | Int | Consecutive-week count |
| avgImpactScore | Float | Average across snapshots |
| isActive | Boolean | False when category disappears |
| firstSeenAt | DateTime | |

### `User`

Synced from Clerk on first sign-in.

| Field | Type | Notes |
|---|---|---|
| id | String | Clerk userId (`sub` from JWT) |
| email | String | Unique |
| firstName | String? | |
| lastName | String? | |

### `RestaurantOwnership`

Maps users to restaurants. Created via `POST /api/auth/restaurants/:id/claim`.

| Field | Type | Notes |
|---|---|---|
| userId | FK → User | |
| restaurantId | FK → Restaurant | Unique pair |
| role | String | `owner` |

### `OwnerEvent`

Operational change log — correlate with review velocity trends.

| Field | Type | Notes |
|---|---|---|
| restaurantId | FK | |
| description | String | Free text (e.g. "Changed head chef") |
| eventDate | DateTime | When the change happened |

### `HealthScore`

Composite 0–100 weekly score. Recomputed after each insight run.

| Field | Type | Notes |
|---|---|---|
| restaurantId | FK | Unique per week |
| weekStart | DateTime | |
| score | Float | Final 0–100 |
| ratingComponent | Float | Avg rating scaled 0–100 |
| sentimentComponent | Float | % positive reviews |
| velocityComponent | Float | % positive velocity |
| persistentPenalty | Float | –8 per active issue (max 40) |
| fakePenalty | Float | % suspicious × 30 (max 30) |

### `ScrapeJob`

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| restaurantId | FK? | |
| status | String | pending / running / completed / failed |
| jobType | String | scrape / insights |
| bullJobId | String? | BullMQ job ID |
| reviewsFound | Int | Reviews scraped or insights generated |
| error | String? | |

---

## API Reference

### Restaurants

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/restaurants` | List all active restaurants |
| GET | `/api/restaurants/:id` | Get restaurant details |
| POST | `/api/restaurants` | Add a restaurant |
| POST | `/api/restaurants/:id/scrape` | Manually trigger scrape |
| PATCH | `/api/restaurants/:id/digest` | Set owner email + digest toggle |
| GET | `/api/restaurants/:id/events` | Owner event log |
| POST | `/api/restaurants/:id/events` | Log operational change |
| DELETE | `/api/restaurants/:id/events/:eventId` | Remove event |
| GET | `/api/restaurants/:id/health-score` | Health score (latest + 12-week history) |

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/sync` | Sync Clerk user to DB (call on sign-in) |
| GET | `/api/auth/me` | Current user + owned restaurants |
| POST | `/api/auth/restaurants/:id/claim` | Claim restaurant ownership |

All auth endpoints require `Authorization: Bearer <clerk-session-token>`.

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

**PATCH `/api/restaurants/:id/digest` body:**
```json
{ "ownerEmail": "owner@restaurant.com", "digestEnabled": true }
```

### Reviews

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/reviews/restaurant/:id` | Paginated reviews (supports `?minRating=&maxRating=`) |
| GET | `/api/reviews/restaurant/:id/stats` | Rating distribution + totals |

### Insights & Analytics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/insights` | All restaurants — top 3 insights each |
| GET | `/api/insights/restaurant/:id` | All insights (`?priority=high\|medium\|low`) |
| GET | `/api/insights/restaurant/:id/diff` | Insights with week-over-week delta + trend |
| GET | `/api/insights/restaurant/:id/dishes` | Dish mentions sorted by count |
| GET | `/api/insights/restaurant/:id/staff` | Staff mentions sorted by count |
| GET | `/api/insights/restaurant/:id/velocity` | Daily time-series + active alerts |
| GET | `/api/insights/restaurant/:id/fake-reviews` | Suspicious reviews + summary |
| GET | `/api/insights/restaurant/:id/price-sensitivity` | Weekly value score time-series |
| GET | `/api/insights/restaurant/:id/persistent-issues` | Active structural issues (3+ weeks) |
| GET | `/api/insights/restaurant/:id/red-flags` | Reviews with critical keywords (food poisoning, cockroach, etc.) |
| GET | `/api/insights/alerts` | Active velocity alerts — all restaurants |
| GET | `/api/insights/digest/unsubscribe/:token` | One-click digest unsubscribe (returns HTML) |
| POST | `/api/insights/restaurant/:id/generate` | Manually trigger insight generation |

### Jobs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/jobs` | Recent jobs (`?status=&restaurantId=`) |
| GET | `/api/jobs/queue-stats` | Live BullMQ queue counts |
| GET | `/api/jobs/:id` | Single job detail |

---

## Local Development

### Prerequisites
- Node.js 20+
- Docker (Redis only — database is Turso cloud)
- Turso account + database

### 1. Start Redis
```bash
docker compose up redis -d
```

### 2. Backend setup
```bash
cd backend
cp .env.example .env
# Fill in required vars (see below)
npm install
npm run db:migrate-turso   # push schema to Turso V1–V7 (idempotent, safe to re-run)
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

```env
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
APIFY_ACTOR_ID=compass~google-maps-reviews-scraper
APIFY_ZOMATO_ACTOR_ID=emastra~zomato-reviews-scraper

# Redis — local Docker (default)
REDIS_HOST=localhost
REDIS_PORT=6379
# OR Upstash — set this instead and leave REDIS_HOST/PORT unset
# REDIS_URL=rediss://:password@host.upstash.io:6379

# Telegram (optional — real-time velocity + escalation alerts)
TELEGRAM_ACCESS_TOKEN=<your-bot-token>
TELEGRAM_CHAT_ID=<your-chat-id>

# Clerk (auth)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>

# Scraping limits (controls Apify cost)
MAX_REVIEWS_PER_RESTAURANT=10
MAX_ZOMATO_REVIEWS_PER_RESTAURANT=5

# SendGrid (weekly digest email)
SENDGRID_EMAIL_API_KEY=<your-key>
SENDGRID_FROM_EMAIL=noreply@restopulse.com
SENDGRID_FROM_NAME=RestoPulse
BACKEND_URL=http://localhost:3001   # used in unsubscribe links

# App
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

---

## Cron Jobs

Two BullMQ repeatable jobs register on startup — both idempotent (server restarts do not create duplicates).

### Daily Scrape — `daily-scrape-all`
- Pattern: `53 16 * * *` (configurable via `CRON_PATTERN` in `queues/index.ts`)
- For each active restaurant: queues a Google scrape and/or Zomato scrape job
- Each scrape triggers: velocity compute → fake review scoring → price sensitivity compute → insight generation

### Weekly Digest — `weekly-digest-all`
- Pattern: `30 2 * * 1` (Monday 8am IST)
- Sends HTML email via SendGrid to all restaurants with `ownerEmail` set and `digestEnabled=true`
- Email includes: velocity alerts, persistent issues, top 3 insights with trend badges, dish complaints, staff flags
- Unsubscribe is handled server-side at `GET /api/insights/digest/unsubscribe/:token`

---

## Turso Migration

The migration script is versioned and idempotent — safe to run at any time:

```bash
cd backend && npm run db:migrate-turso
```

Versions:
- **V1** — base schema (Restaurant, Review, ActionableInsight, ScrapeJob)
- **V2** — zomatoUrl + multi-source support
- **V3** — InsightSnapshot, DishMention
- **V4** — StaffMention, ReviewVelocity, VelocityAlert, FakeReviewScore
- **V5** — PriceSensitivity, PersistentIssue + Restaurant digest columns
- **V6** — User, RestaurantOwnership, OwnerEvent, HealthScore
- **V7** — `isRedFlag` + `redFlagWords` columns on Review

Each version checks for its own existence before running. No data is ever dropped.

---

## Project Structure

```
backend/src/
├── config/
│   ├── index.ts          env config (groq, apify, sendgrid, redis, workers)
│   └── redis.ts          Redis connection factory
├── db/
│   └── client.ts         Prisma + libsql adapter
├── queues/
│   └── index.ts          scrapeQueue, insightsQueue, digestQueue + cron setup
├── workers/
│   ├── index.ts          startWorkers() — scrape + insights + digest
│   ├── scrape.worker.ts  Apify → reviews → velocity + fake scores + price + red flags
│   ├── insights.worker.ts GROQ insights → snapshot → dishes + staff + escalation
│   └── digest.worker.ts  Weekly SendGrid email dispatch
├── middleware/
│   └── auth.middleware.ts       JWT decode (Clerk) + userId injection
├── services/
│   ├── apify.service.ts         Google Maps + Zomato scraper
│   ├── groq.service.ts          Insights + dish NER + staff NER prompts
│   ├── restaurant.service.ts    CRUD + metadata upsert
│   ├── review.service.ts        Batch upsert + stats
│   ├── insight.service.ts       Generate + snapshot + diff + dish + staff
│   ├── velocity.service.ts      Daily velocity compute + spike alerts + Telegram
│   ├── fakeReview.service.ts    Rule-based authenticity scoring
│   ├── priceSensitivity.service.ts  Keyword scan → weekly value score
│   ├── escalation.service.ts    Persistent issue detection + Telegram at week 6
│   ├── healthScore.service.ts   Composite 0-100 score (rating/sentiment/velocity)
│   ├── redFlag.service.ts       Critical keyword scan + immediate Telegram alert
│   ├── telegram.service.ts      Telegram Bot real-time alerts
│   └── email.service.ts         SendGrid digest builder + sender
├── routes/
│   ├── restaurants.route.ts     CRUD + scrape + digest + events + health-score
│   ├── reviews.route.ts         Paginated reviews + stats
│   ├── insights.route.ts        Insights + diff + dishes + staff + velocity
│   │                            + fake reviews + price + persistent + red-flags + unsubscribe
│   ├── auth.route.ts            Clerk sync + me + claim restaurant
│   └── jobs.route.ts            BullMQ job status
├── types/
│   └── index.ts          Zod schemas — insights, dishes, staff
├── utils/
│   └── logger.ts
└── index.ts              Express bootstrap + queue init + cron schedule

backend/prisma/
├── schema.prisma         16 models (sqlite provider + driverAdapters)
├── migrate-turso.ts      Versioned DDL migration (V1–V7, idempotent)
├── seed.ts               Restaurant seed script
└── cleanup-old-db.ts     One-time cleanup helper

frontend/src/
├── middleware.ts                Clerk auth — protects /dashboard/**
├── app/
│   ├── sign-in/[[...sign-in]]/ Clerk sign-in page (glassmorphism)
│   ├── sign-up/[[...sign-up]]/ Clerk sign-up page (glassmorphism)
│   ├── dashboard/              Restaurant grid + UserButton
│   ├── dashboard/[id]/         Per-restaurant detail page
│   └── dashboard/add/          Add restaurant form
├── components/dashboard/
│   ├── InsightPanel            Colour-coded insight + week-over-week trend badge
│   ├── DishMentionCard         Dish + sentiment bar chart
│   ├── StaffMentionTable       Staff name table with HR signal
│   ├── VelocityChart           Area chart + alert banners
│   ├── FakeReviewPanel         Suspicion summary + expandable flagged list
│   ├── PriceSensitivityChart   Weekly value score line chart
│   ├── PersistentIssuesPanel   Structural issues with severity coding
│   ├── RedFlagPanel            Critical keyword reviews — keyword badges, date, source
│   ├── DigestConfig            Email + toggle save inline
│   ├── HealthScoreCard         Composite 0-100 score with radial + component bars
│   ├── OwnerEventLog           Operational change log with inline add/delete
│   ├── RestaurantCard          Dashboard card (glassmorphism)
│   ├── QueueStats              Live BullMQ banner
│   └── RatingChart             Rating distribution bar chart
└── lib/
    ├── api.ts     Axios client + all fetch/mutation helpers (auth, events, health)
    └── utils.ts   cn() Tailwind class merger
```

---

## Adding a Restaurant

Via dashboard UI (`+ Add Restaurant`) or API:

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

## Configuring Digest Email

Via dashboard (Notifications section on restaurant page) or API:

```bash
curl -X PATCH http://localhost:3001/api/restaurants/<id>/digest \
  -H "Content-Type: application/json" \
  -d '{ "ownerEmail": "owner@restaurant.com", "digestEnabled": true }'
```

---

## Build Status

### Core Infrastructure
- [x] Monorepo scaffold — backend + frontend + docker-compose
- [x] Turso schema — versioned migrations V1–V6
- [x] BullMQ queues — `scrape`, `insights`, `digest`
- [x] Workers — scrapeWorker, insightsWorker, digestWorker
- [x] Dual-source scraping — Google Maps + Zomato per restaurant
- [x] Cross-source insights — GROQ sees combined review pool
- [x] REST API — restaurants, reviews, insights, jobs
- [x] Next.js 14 dashboard — restaurant grid + per-restaurant detail
- [x] Daily cron (BullMQ repeatable, idempotent)
- [x] Weekly digest cron (Monday 8am IST)

### Analytics Features
- [x] Insight Diffing — week-over-week delta with ↑↓/NEW trend badges
- [x] Dish-Level Mention Extraction — GROQ NER, sentiment breakdown per dish
- [x] Staff Mention Tracking — first-name NER, HR signal (star performer / needs attention)
- [x] Review Velocity Alerts — 7-day rolling window, negative + positive spike detection
- [x] Fake Review Detection — rule-based scoring (text length, rating mismatch, burst timing)
- [x] Price Sensitivity Tracker — keyword scan, weekly value score time-series
- [x] Complaint Escalation — persistent issue detection at 3+ consecutive weeks
- [x] Red Flag Alert System — keyword scan (food poisoning, cockroach, overcharged…) → immediate Telegram alert
- [x] Weekly Digest Email — SendGrid HTML, insights diff + alerts + dishes + staff flags
- [x] Digest unsubscribe — token-based, one-click, server-side
- [x] Telegram Real-Time Alerts — velocity spike + persistent issue week-6 threshold
- [x] Restaurant Health Score — composite 0–100 (rating 30% + sentiment 25% + velocity 20% – penalties 25%)
- [x] Owner Event Log — operational change markers (head chef change, menu relaunch, etc.)
- [x] Clerk Auth — `@clerk/nextjs` frontend, manual JWT decode on backend, RestaurantOwnership model
- [x] Redis/Upstash support — `REDIS_URL` env var for Upstash (auto TLS for `rediss://`)

### UI
- [x] Glassmorphism dark design system — `backdrop-blur`, frosted glass cards, dark gradient background
- [x] Clerk sign-in / sign-up pages with glassmorphism styling
- [x] All components updated: dark palette, `glass-card`, `glass-button`, `glass-input` utilities

### Dashboard Components
- [x] InsightPanel with trend badges
- [x] DishMentionCard with sentiment bar
- [x] StaffMentionTable with HR signal
- [x] VelocityChart (area chart + alert banners)
- [x] FakeReviewPanel with expandable flag list
- [x] PriceSensitivityChart (line chart, colour-coded)
- [x] PersistentIssuesPanel with severity coding
- [x] DigestConfig (inline email + toggle)
- [x] HealthScoreCard (radial gauge + component breakdown bars)
- [x] OwnerEventLog (inline add / delete with date picker)
- [x] RedFlagPanel (critical keyword reviews with severity badges + date + source)
- [x] FakeReviewPanel updated — source badge (Google/Zomato) + review date visible
