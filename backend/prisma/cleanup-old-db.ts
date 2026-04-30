import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
  url: process.env.EARLIER_DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const DROP = [
  'DROP TABLE IF EXISTS "ScrapeJob"',
  'DROP TABLE IF EXISTS "ActionableInsight"',
  'DROP TABLE IF EXISTS "Review"',
  'DROP TABLE IF EXISTS "Restaurant"',
];

async function cleanup() {
  console.log('Testing connection to old DB...');
  await client.execute('SELECT 1');
  console.log('Connected. Dropping RestoPulse tables from old DB...');

  for (const sql of DROP) {
    await client.execute(sql);
    console.log('  ', sql);
  }

  // Confirm nothing left
  const tables = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Restaurant','Review','ActionableInsight','ScrapeJob')`
  );
  if (tables.rows.length === 0) {
    console.log('Done — all RestoPulse tables removed from old DB.');
  } else {
    console.log('WARNING: tables still present:', tables.rows.map((r) => r.name));
  }
}

cleanup().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
