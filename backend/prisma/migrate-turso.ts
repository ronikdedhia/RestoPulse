import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const DDL = `
CREATE TABLE IF NOT EXISTS "Restaurant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "googleMapsUrl" TEXT,
  "zomatoUrl" TEXT,
  "placeId" TEXT,
  "rating" REAL,
  "totalReviews" INTEGER,
  "cuisine" TEXT,
  "priceLevel" TEXT,
  "website" TEXT,
  "phone" TEXT,
  "imageUrl" TEXT,
  "lastScraped" DATETIME,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "Restaurant_googleMapsUrl_key" ON "Restaurant"("googleMapsUrl");
CREATE UNIQUE INDEX IF NOT EXISTS "Restaurant_placeId_key" ON "Restaurant"("placeId");
CREATE INDEX IF NOT EXISTS "Restaurant_isActive_idx" ON "Restaurant"("isActive");

CREATE TABLE IF NOT EXISTS "Review" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "restaurantId" TEXT NOT NULL,
  "externalId" TEXT,
  "reviewerName" TEXT,
  "rating" INTEGER NOT NULL,
  "text" TEXT,
  "reviewDate" DATETIME,
  "sentiment" TEXT,
  "topics" TEXT,
  "language" TEXT,
  "source" TEXT NOT NULL DEFAULT 'google_maps',
  "scrapedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Review_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Review_externalId_key" ON "Review"("externalId");
CREATE INDEX IF NOT EXISTS "Review_restaurantId_idx" ON "Review"("restaurantId");
CREATE INDEX IF NOT EXISTS "Review_sentiment_idx" ON "Review"("sentiment");
CREATE INDEX IF NOT EXISTS "Review_rating_idx" ON "Review"("rating");
CREATE INDEX IF NOT EXISTS "Review_reviewDate_idx" ON "Review"("reviewDate");

CREATE TABLE IF NOT EXISTS "ActionableInsight" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "restaurantId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "insight" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "overallSentiment" TEXT NOT NULL,
  "evidenceCount" INTEGER NOT NULL DEFAULT 0,
  "keyThemes" TEXT,
  "suggestedAction" TEXT,
  "impactScore" REAL,
  "reviewPeriod" TEXT,
  "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActionableInsight_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ActionableInsight_restaurantId_idx" ON "ActionableInsight"("restaurantId");
CREATE INDEX IF NOT EXISTS "ActionableInsight_priority_idx" ON "ActionableInsight"("priority");
CREATE INDEX IF NOT EXISTS "ActionableInsight_category_idx" ON "ActionableInsight"("category");
CREATE INDEX IF NOT EXISTS "ActionableInsight_generatedAt_idx" ON "ActionableInsight"("generatedAt");

CREATE TABLE IF NOT EXISTS "ScrapeJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "restaurantId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "jobType" TEXT NOT NULL DEFAULT 'scrape',
  "bullJobId" TEXT,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "reviewsFound" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScrapeJob_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ScrapeJob_status_idx" ON "ScrapeJob"("status");
CREATE INDEX IF NOT EXISTS "ScrapeJob_restaurantId_idx" ON "ScrapeJob"("restaurantId");
CREATE INDEX IF NOT EXISTS "ScrapeJob_createdAt_idx" ON "ScrapeJob"("createdAt");
`;

async function migrate() {
  console.log('Applying base schema to Turso...');
  const statements = DDL.split(';').map((s) => s.trim()).filter(Boolean);
  for (const sql of statements) {
    await client.execute(sql);
  }
  console.log('Base schema done.');
}

async function migrateV2() {
  // Check if already migrated
  const info = await client.execute(`PRAGMA table_info("Restaurant")`);
  const cols = (info.rows as any[]).map((r) => r.name as string);

  if (cols.includes('zomatoUrl')) {
    console.log('V2 already applied, skipping.');
    return;
  }

  console.log('Applying V2: googleMapsUrl nullable + zomatoUrl + drop sourceType...');

  // SQLite can't ALTER column nullability — recreate the table
  const copyColumns = '"id","name","address","googleMapsUrl","placeId","rating","totalReviews","cuisine","priceLevel","website","phone","imageUrl","lastScraped","isActive","createdAt","updatedAt"';

  const steps = [
    `CREATE TABLE "Restaurant_v2" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "googleMapsUrl" TEXT,
      "zomatoUrl" TEXT,
      "placeId" TEXT,
      "rating" REAL,
      "totalReviews" INTEGER,
      "cuisine" TEXT,
      "priceLevel" TEXT,
      "website" TEXT,
      "phone" TEXT,
      "imageUrl" TEXT,
      "lastScraped" DATETIME,
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    `INSERT INTO "Restaurant_v2" (${copyColumns}, "zomatoUrl") SELECT ${copyColumns}, NULL FROM "Restaurant"`,
    `DROP TABLE "Restaurant"`,
    `ALTER TABLE "Restaurant_v2" RENAME TO "Restaurant"`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Restaurant_googleMapsUrl_key" ON "Restaurant"("googleMapsUrl")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Restaurant_zomatoUrl_key" ON "Restaurant"("zomatoUrl")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Restaurant_placeId_key" ON "Restaurant"("placeId")`,
    `CREATE INDEX IF NOT EXISTS "Restaurant_isActive_idx" ON "Restaurant"("isActive")`,
  ];

  for (const sql of steps) {
    await client.execute(sql);
  }

  console.log('V2 migration done.');
}

async function migrateV3() {
  const info = await client.execute(`PRAGMA table_info("InsightSnapshot")`);
  if ((info.rows as any[]).length > 0) {
    console.log('V3 already applied, skipping.');
    return;
  }

  console.log('Applying V3: InsightSnapshot + DishMention tables...');

  const steps = [
    `CREATE TABLE IF NOT EXISTS "InsightSnapshot" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "restaurantId" TEXT NOT NULL,
      "weekStart" DATETIME NOT NULL,
      "category" TEXT NOT NULL,
      "impactScore" REAL NOT NULL,
      "priority" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InsightSnapshot_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "InsightSnapshot_restaurantId_weekStart_idx" ON "InsightSnapshot"("restaurantId", "weekStart")`,
    `CREATE TABLE IF NOT EXISTS "DishMention" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "restaurantId" TEXT NOT NULL,
      "dish" TEXT NOT NULL,
      "mentions" INTEGER NOT NULL,
      "positiveMentions" INTEGER NOT NULL DEFAULT 0,
      "negativeMentions" INTEGER NOT NULL DEFAULT 0,
      "extractedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DishMention_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "DishMention_restaurantId_idx" ON "DishMention"("restaurantId")`,
    `CREATE INDEX IF NOT EXISTS "DishMention_restaurantId_mentions_idx" ON "DishMention"("restaurantId", "mentions")`,
  ];

  for (const sql of steps) {
    await client.execute(sql);
  }

  console.log('V3 migration done.');
}

async function migrateV4() {
  const info = await client.execute(`PRAGMA table_info("StaffMention")`);
  if ((info.rows as any[]).length > 0) {
    console.log('V4 already applied, skipping.');
    return;
  }

  console.log('Applying V4: StaffMention, ReviewVelocity, VelocityAlert, FakeReviewScore tables...');

  const steps = [
    `CREATE TABLE IF NOT EXISTS "StaffMention" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "restaurantId" TEXT NOT NULL,
      "staffName" TEXT NOT NULL,
      "mentions" INTEGER NOT NULL,
      "positiveMentions" INTEGER NOT NULL DEFAULT 0,
      "negativeMentions" INTEGER NOT NULL DEFAULT 0,
      "extractedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StaffMention_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "StaffMention_restaurantId_idx" ON "StaffMention"("restaurantId")`,

    `CREATE TABLE IF NOT EXISTS "ReviewVelocity" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "restaurantId" TEXT NOT NULL,
      "date" DATETIME NOT NULL,
      "totalReviews" INTEGER NOT NULL DEFAULT 0,
      "positiveCount" INTEGER NOT NULL DEFAULT 0,
      "negativeCount" INTEGER NOT NULL DEFAULT 0,
      "avgRating" REAL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReviewVelocity_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ReviewVelocity_restaurantId_date_key" ON "ReviewVelocity"("restaurantId", "date")`,
    `CREATE INDEX IF NOT EXISTS "ReviewVelocity_restaurantId_date_idx" ON "ReviewVelocity"("restaurantId", "date")`,

    `CREATE TABLE IF NOT EXISTS "VelocityAlert" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "restaurantId" TEXT NOT NULL,
      "alertType" TEXT NOT NULL,
      "severity" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "reviewsPerDay" REAL NOT NULL,
      "baseline" REAL NOT NULL,
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "resolvedAt" DATETIME,
      CONSTRAINT "VelocityAlert_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "VelocityAlert_restaurantId_isActive_idx" ON "VelocityAlert"("restaurantId", "isActive")`,
    `CREATE INDEX IF NOT EXISTS "VelocityAlert_isActive_idx" ON "VelocityAlert"("isActive")`,

    `CREATE TABLE IF NOT EXISTS "FakeReviewScore" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "reviewId" TEXT NOT NULL,
      "restaurantId" TEXT NOT NULL,
      "authenticityScore" REAL NOT NULL,
      "flags" TEXT,
      "isSuspicious" INTEGER NOT NULL DEFAULT 0,
      "scoredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FakeReviewScore_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FakeReviewScore_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "FakeReviewScore_reviewId_key" ON "FakeReviewScore"("reviewId")`,
    `CREATE INDEX IF NOT EXISTS "FakeReviewScore_restaurantId_isSuspicious_idx" ON "FakeReviewScore"("restaurantId", "isSuspicious")`,
  ];

  for (const sql of steps) {
    await client.execute(sql);
  }

  console.log('V4 migration done.');
}

async function migrateV5() {
  const info = await client.execute(`PRAGMA table_info("PriceSensitivity")`);
  if ((info.rows as any[]).length > 0) {
    console.log('V5 already applied, skipping.');
    return;
  }

  console.log('Applying V5: PriceSensitivity, PersistentIssue + Restaurant digest columns...');

  const steps = [
    // Add digest columns to Restaurant (ALTER TABLE ADD COLUMN is safe in SQLite)
    `ALTER TABLE "Restaurant" ADD COLUMN "ownerEmail" TEXT`,
    `ALTER TABLE "Restaurant" ADD COLUMN "digestEnabled" INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE "Restaurant" ADD COLUMN "unsubscribeToken" TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Restaurant_unsubscribeToken_key" ON "Restaurant"("unsubscribeToken")`,

    `CREATE TABLE IF NOT EXISTS "PriceSensitivity" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "restaurantId" TEXT NOT NULL,
      "weekStart" DATETIME NOT NULL,
      "valueScore" REAL NOT NULL,
      "mentionCount" INTEGER NOT NULL DEFAULT 0,
      "positiveMentions" INTEGER NOT NULL DEFAULT 0,
      "negativeMentions" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PriceSensitivity_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PriceSensitivity_restaurantId_weekStart_key" ON "PriceSensitivity"("restaurantId", "weekStart")`,
    `CREATE INDEX IF NOT EXISTS "PriceSensitivity_restaurantId_weekStart_idx" ON "PriceSensitivity"("restaurantId", "weekStart")`,

    `CREATE TABLE IF NOT EXISTS "PersistentIssue" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "restaurantId" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "weeksSeen" INTEGER NOT NULL DEFAULT 0,
      "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "avgImpactScore" REAL NOT NULL DEFAULT 0,
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "resolvedAt" DATETIME,
      CONSTRAINT "PersistentIssue_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PersistentIssue_restaurantId_category_key" ON "PersistentIssue"("restaurantId", "category")`,
    `CREATE INDEX IF NOT EXISTS "PersistentIssue_restaurantId_isActive_idx" ON "PersistentIssue"("restaurantId", "isActive")`,
  ];

  for (const sql of steps) {
    await client.execute(sql);
  }

  console.log('V5 migration done.');
}

async function migrateV6() {
  const info = await client.execute(`PRAGMA table_info("HealthScore")`);
  if ((info.rows as any[]).length > 0) {
    console.log('V6 already applied, skipping.');
    return;
  }

  console.log('Applying V6: User, RestaurantOwnership, OwnerEvent, HealthScore tables...');

  const steps = [
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "firstName" TEXT,
      "lastName" TEXT,
      "imageUrl" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,

    `CREATE TABLE IF NOT EXISTS "RestaurantOwnership" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "restaurantId" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'owner',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RestaurantOwnership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "RestaurantOwnership_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantOwnership_userId_restaurantId_key" ON "RestaurantOwnership"("userId", "restaurantId")`,
    `CREATE INDEX IF NOT EXISTS "RestaurantOwnership_userId_idx" ON "RestaurantOwnership"("userId")`,
    `CREATE INDEX IF NOT EXISTS "RestaurantOwnership_restaurantId_idx" ON "RestaurantOwnership"("restaurantId")`,

    `CREATE TABLE IF NOT EXISTS "OwnerEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "restaurantId" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "eventDate" DATETIME NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OwnerEvent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "OwnerEvent_restaurantId_eventDate_idx" ON "OwnerEvent"("restaurantId", "eventDate")`,

    `CREATE TABLE IF NOT EXISTS "HealthScore" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "restaurantId" TEXT NOT NULL,
      "weekStart" DATETIME NOT NULL,
      "score" REAL NOT NULL,
      "ratingComponent" REAL NOT NULL,
      "sentimentComponent" REAL NOT NULL,
      "velocityComponent" REAL NOT NULL,
      "persistentPenalty" REAL NOT NULL,
      "fakePenalty" REAL NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HealthScore_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "HealthScore_restaurantId_weekStart_key" ON "HealthScore"("restaurantId", "weekStart")`,
    `CREATE INDEX IF NOT EXISTS "HealthScore_restaurantId_weekStart_idx" ON "HealthScore"("restaurantId", "weekStart")`,
  ];

  for (const sql of steps) {
    await client.execute(sql);
  }

  console.log('V6 migration done.');
}

async function migrateV7() {
  const info = await client.execute(`PRAGMA table_info("Review")`);
  const cols = (info.rows as any[]).map((r) => r.name as string);

  if (cols.includes('isRedFlag')) {
    console.log('V7 already applied, skipping.');
    return;
  }

  console.log('Applying V7: isRedFlag + redFlagWords columns on Review...');

  await client.execute(`ALTER TABLE "Review" ADD COLUMN "isRedFlag" INTEGER NOT NULL DEFAULT 0`);
  await client.execute(`ALTER TABLE "Review" ADD COLUMN "redFlagWords" TEXT`);

  console.log('V7 migration done.');
}

async function main() {
  await migrate();
  await migrateV2();
  await migrateV3();
  await migrateV4();
  await migrateV5();
  await migrateV6();
  await migrateV7();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
