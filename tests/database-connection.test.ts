import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseConnection } from '../lib/server/database-connection';

void test('Supabase verifies certificates without machine-local certificate paths', () => {
  const input =
    'postgresql://postgres.test:example@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require&sslrootcert=/local/file&application_name=jobx';
  const result = databaseConnection(input);
  assert.equal(typeof result.ssl, 'object');
  if (typeof result.ssl !== 'object') throw new Error('TLS options missing');
  assert.equal(result.ssl.rejectUnauthorized, true);
  assert.match(String(result.ssl.ca), /BEGIN CERTIFICATE/);
  const url = new URL(result.connectionString!);
  assert.equal(url.searchParams.has('sslrootcert'), false);
  assert.equal(url.searchParams.has('sslmode'), false);
  assert.equal(url.searchParams.get('application_name'), 'jobx');
  assert.equal(url.port, '5432');
});

void test('other providers retain their original TLS settings', () => {
  const input = 'postgresql://u:p@db.example.com/db?sslmode=verify-full';
  assert.deepEqual(databaseConnection(input), { connectionString: input });
  assert.throws(() => databaseConnection(''), /DATABASE_URL/);
});
