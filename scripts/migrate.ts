import 'dotenv/config';
import fs from 'node:fs/promises';
import { db } from '../lib/server/db';
const client = await db().connect();
try {
  await client.query('SELECT pg_advisory_lock(917400)');
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  for (const name of (await fs.readdir('db/migrations'))
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    if (
      (
        await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [
          name,
        ])
      ).rowCount
    )
      continue;
    await client.query('BEGIN');
    try {
      await client.query(await fs.readFile('db/migrations/' + name, 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [
        name,
      ]);
      await client.query('COMMIT');
      console.log('Applied', name);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }
  }
  await client.query(
    "INSERT INTO sources(id,name) VALUES('hr','hr.ge'),('jobs','jobs.ge') ON CONFLICT DO NOTHING",
  );
} finally {
  await client.query('SELECT pg_advisory_unlock(917400)');
  client.release();
  await db().end();
}
