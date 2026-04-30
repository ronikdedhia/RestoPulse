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

async function main() {
  await migrate();
  await migrateV2();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
