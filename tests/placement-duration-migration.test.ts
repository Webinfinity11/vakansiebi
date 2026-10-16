import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { db } from '../lib/server/db';

void test(
  'duration correction preserves activation, overrides and sent mail and is idempotent',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/ertad_test');
    const c = await db().connect();
    const id = (n: number) =>
      `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const start = new Date('2026-09-01T10:30:00Z');
    const end = (days: number) =>
      new Date(+start + days * 86400000).toISOString();
    try {
      await c.query('BEGIN');
      // Temporary tables shadow business tables: the exact migration runs against
      // representative historical records without touching any existing data.
      await c.query(`
        CREATE TEMP TABLE jobs(id uuid PRIMARY KEY,placement_tier text,placement_expires_at timestamptz,
          version int DEFAULT 1,updated_at timestamptz DEFAULT now(),status text DEFAULT 'published');
        CREATE TEMP TABLE job_invoices(id uuid PRIMARY KEY,job_id uuid,service_days int,
          amount_gel int DEFAULT 20,status text,activated_at timestamptz,paid_at timestamptz);
        CREATE TEMP TABLE job_submissions(job_id uuid,bonus_company_key text);
        CREATE TEMP TABLE audit_log(id bigint GENERATED ALWAYS AS IDENTITY,job_id uuid,action text,
          actor text,before_data jsonb,after_data jsonb,created_at timestamptz DEFAULT now());
        CREATE TEMP TABLE invoice_email_delivery(invoice_id uuid,payload jsonb,status text,
          attempts int,first_attempt_at timestamptz);
      `);
      for (let n = 1; n <= 8; n++) {
        const vip = n >= 5 && n <= 7;
        const days = n === 2 ? 30 : n === 3 ? 45 : n === 6 ? 9 : 14;
        await c.query(
          'INSERT INTO jobs(id,placement_tier,placement_expires_at) VALUES($1,$2,$3)',
          [
            id(n),
            vip ? 'vip' : [4, 8].includes(n) ? 'standard' : 'premium',
            [4, 8].includes(n) ? null : end(days),
          ],
        );
        if (vip) {
          await c.query('INSERT INTO job_submissions VALUES($1,$2)', [
            id(n),
            `company-${n}`,
          ]);
          await c.query(
            `INSERT INTO audit_log(job_id,action,actor,after_data,created_at)
            VALUES($1,'placement.approved','admin','{"tier":"vip","days":14}',$2)`,
            [id(n), start],
          );
        } else {
          await c.query(
            `INSERT INTO job_invoices(id,job_id,service_days,status,activated_at,paid_at)
            VALUES($1,$1,$2,$3,$4,$4)`,
            [
              id(n),
              n === 2 ? 30 : 14,
              n === 4 ? 'cancelled' : n === 8 ? 'pending' : 'paid',
              [4, 8].includes(n) ? null : start,
            ],
          );
          await c.query(
            `INSERT INTO invoice_email_delivery VALUES($1,$2,$3,$4,$5)`,
            [
              id(n),
              {
                html: 'პრემიუმ განთავსება · 14 დღე',
                text: 'პრემიუმ განთავსება · 14 დღე',
              },
              n === 1 ? 'sent' : 'pending',
              n === 1 || n === 3 ? 1 : 0,
              n === 1 || n === 3 ? start : null,
            ],
          );
        }
      }
      const migration = await readFile(
        new URL(
          '../db/migrations/057_correct_placement_durations.sql',
          import.meta.url,
        ),
        'utf8',
      );
      const snapshot = async () => ({
        jobs: (await c.query('SELECT * FROM jobs ORDER BY id')).rows,
        invoices: (await c.query('SELECT * FROM job_invoices ORDER BY id'))
          .rows,
        emails: (
          await c.query(
            'SELECT * FROM invoice_email_delivery ORDER BY invoice_id',
          )
        ).rows,
        logs: (await c.query('SELECT * FROM audit_log ORDER BY id')).rows,
      });
      await c.query(migration);
      const first = await snapshot();
      const job = (n: number) => first.jobs.find((j) => j.id === id(n))!;
      assert.equal(job(1).placement_expires_at.toISOString(), end(30));
      assert.equal(job(2).placement_expires_at.toISOString(), end(30));
      assert.equal(
        job(3).placement_expires_at.toISOString(),
        end(45),
        'manual expiry is preserved',
      );
      assert.equal(job(5).placement_expires_at.toISOString(), end(15));
      assert.equal(
        job(6).placement_expires_at.toISOString(),
        end(9),
        'manual VIP expiry is preserved',
      );
      assert.equal(
        job(7).placement_expires_at.toISOString(),
        end(15),
        'old VIP is not restarted from today',
      );
      assert.ok(first.jobs.every((j) => j.status === 'published'));
      assert.equal(
        first.invoices.find((i) => i.id === id(4))!.service_days,
        14,
        'cancelled invoice is unchanged',
      );
      assert.ok(
        first.invoices
          .filter((i) => i.id !== id(4))
          .every((i) => i.service_days === 30),
      );
      assert.equal(
        first.invoices.find((i) => i.id === id(1))!.activated_at.toISOString(),
        start.toISOString(),
      );
      assert.equal(
        first.emails.find((e) => e.invoice_id === id(1))!.payload.text,
        'პრემიუმ განთავსება · 14 დღე',
      );
      assert.equal(
        first.emails.find((e) => e.invoice_id === id(3))!.payload.text,
        'პრემიუმ განთავსება · 14 დღე',
      );
      assert.equal(
        first.emails.find((e) => e.invoice_id === id(8))!.payload.text,
        'პრემიუმ განთავსება · 30 დღე',
      );
      assert.equal(
        first.logs.filter((a) => a.action === 'placement.duration-corrected')
          .length,
        5,
      );
      await c.query(migration);
      assert.deepEqual(
        await snapshot(),
        first,
        'rerunning does not renew periods or duplicate audit records',
      );
    } finally {
      await c.query('ROLLBACK');
      c.release();
      await db().end();
    }
  },
);
