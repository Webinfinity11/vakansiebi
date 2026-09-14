import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { dueSourcesSql } from '../worker/scheduler';
import { reconciliationCandidatesSql } from '../worker/automation';

void test(
  'database schedules skip unchanged records and disabled sources while retaining repairs and expiry',
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const client = new Client({
      connectionString: process.env.TEST_DATABASE_URL,
    });
    await client.connect();
    try {
      // Temporary tables shadow real names only for this connection; no live rows change.
      await client.query(`
      CREATE TEMP TABLE sources(id text,enabled boolean DEFAULT true,retired boolean DEFAULT false,
        auto_enabled boolean DEFAULT true,auto_publish boolean DEFAULT true,
        next_run_at timestamptz DEFAULT now(),requested_at timestamptz);
      CREATE TEMP TABLE jobs(id text,status text DEFAULT 'published',automation_paused boolean DEFAULT false,
        automation_checked_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()-interval '1 hour',
        draft jsonb DEFAULT '{}');
      CREATE TEMP TABLE source_items(source_id text,job_id text,last_checked_at timestamptz DEFAULT now()-interval '1 hour',
        refresh_requested_at timestamptz,refresh_completed_at timestamptz,next_check_at timestamptz DEFAULT now());
      INSERT INTO sources(id) VALUES('hr'),('jobs'),('ss'),('myjobs'),('samushao'),('worknet');
      UPDATE sources SET enabled=false WHERE id='ss';
      UPDATE sources SET retired=true WHERE id='myjobs';
      UPDATE sources SET next_run_at=now()+interval '1 day' WHERE id IN ('jobs','worknet');
      UPDATE sources SET auto_enabled=false,requested_at=now() WHERE id='jobs';
      INSERT INTO source_items(source_id,refresh_requested_at) VALUES('worknet',now());
      INSERT INTO jobs(id) VALUES('unchanged'),('new'),('expired'),('no-deadline'),('stale'),('archived'),('changed'),('paused');
      UPDATE jobs SET automation_checked_at=NULL WHERE id IN ('new','paused');
      UPDATE jobs SET automation_paused=true WHERE id='paused';
      UPDATE jobs SET draft='{"deadline":"2026-09-13"}' WHERE id='expired';
      UPDATE jobs SET draft='{"deadline":""}' WHERE id='no-deadline';
      UPDATE jobs SET automation_checked_at=now()-interval '2 days',updated_at=now()-interval '3 days' WHERE id IN ('stale','archived');
      UPDATE jobs SET status='archived' WHERE id='archived';
      INSERT INTO source_items(source_id,job_id,last_checked_at)
        SELECT 'hr',id,now()-interval '3 days' FROM jobs;
      UPDATE source_items SET last_checked_at=now()+interval '1 second' WHERE job_id='changed';
    `);
      assert.deepEqual(
        (
          await client.query(dueSourcesSql, [
            ['hr', 'jobs', 'ss', 'myjobs', 'worknet'],
          ])
        ).rows
          .map((r) => r.id)
          .sort((a: string, b: string) => a.localeCompare(b)),
        ['hr', 'jobs', 'worknet'],
      );
      assert.deepEqual(
        (
          await client.query(reconciliationCandidatesSql, ['hr', '2026-09-14'])
        ).rows
          .map((r) => r.id)
          .sort((a: string, b: string) => a.localeCompare(b)),
        ['changed', 'expired', 'new', 'stale'],
      );
    } finally {
      await client.end();
    }
  },
);
