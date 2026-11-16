import test from 'node:test';
import assert from 'node:assert/strict';
import {
  googleAuthUrl,
  googleClaims,
  openValue,
  sealValue,
} from '../lib/server/company-google';

const key = 'k'.repeat(40);
const token = (claims: object) =>
  `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
const base = {
  iss: 'https://accounts.google.com',
  aud: 'client-1',
  exp: Math.floor(Date.now() / 1000) + 600,
  nonce: 'n1',
  sub: '123',
  email: 'HR@Example.com',
  email_verified: true,
  name: 'ნინო',
};

test('accepts a valid Google ID token and normalises the email', () => {
  assert.deepEqual(
    googleClaims(token(base), { clientId: 'client-1', nonce: 'n1' }),
    { sub: '123', email: 'hr@example.com', name: 'ნინო' },
  );
});

test('rejects wrong audience, issuer, nonce, expiry or unverified email', () => {
  const expected = { clientId: 'client-1', nonce: 'n1' };
  for (const bad of [
    { aud: 'other' },
    { iss: 'https://evil.example' },
    { nonce: 'n2' },
    { exp: Math.floor(Date.now() / 1000) - 1 },
    { email_verified: false },
    { email: '' },
    { sub: '' },
  ])
    assert.throws(() => googleClaims(token({ ...base, ...bad }), expected));
  assert.throws(() => googleClaims('not-a-token', expected));
});

test('sealed values reject tampering and expiry', () => {
  const sealed = sealValue({ a: 1, exp: Date.now() + 1000 }, key);
  assert.deepEqual(openValue(sealed, key), {
    a: 1,
    exp: JSON.parse(Buffer.from(sealed.split('.')[0], 'base64url').toString())
      .exp,
  });
  assert.equal(openValue(sealed, 'x'.repeat(40)), null);
  assert.equal(openValue(sealed.replace(/^./, 'A'), key), null);
  assert.equal(openValue(sealValue({ exp: Date.now() - 1 }, key), key), null);
  assert.equal(openValue(undefined, key), null);
});

test('authorization URL uses PKCE S256 and carries state and nonce', () => {
  const url = new URL(
    googleAuthUrl(
      {
        clientId: 'client-1',
        redirectUri: 'https://jobx.ge/api/company/google/callback',
      },
      { state: 's', nonce: 'n', verifier: 'v'.repeat(64) },
    ),
  );
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('state'), 's');
  assert.equal(url.searchParams.get('nonce'), 'n');
  assert.equal(url.searchParams.get('scope'), 'openid email profile');
  assert.notEqual(url.searchParams.get('code_challenge'), 'v'.repeat(64));
});

void test(
  'Google sign-in links a returning account by email, then by subject',
  {
    skip:
      process.env.RUN_DB_TESTS !== '1' ||
      !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? ''),
  },
  async () => {
    const { db } = await import('../lib/server/db');
    const { linkGoogleAccount } = await import('../lib/server/company-google');
    const key = 'googletest' + Date.now();
    const email = key + '@example.com';
    await db().query(
      "INSERT INTO company_profiles(company_key,name,approval_status) VALUES($1,$1,'pending')",
      [key],
    );
    const { rows } = await db().query(
      "INSERT INTO company_accounts(company_key,username,email,password_hash,email_verified) VALUES($1,$1,$2,'x',false) RETURNING id",
      [key, email],
    );
    try {
      const id = rows[0].id;
      assert.equal(
        await linkGoogleAccount({ sub: key + '-sub', email, name: '' }),
        id,
      );
      const linked = await db().query(
        'SELECT google_sub,email_verified FROM company_accounts WHERE id=$1',
        [id],
      );
      assert.deepEqual(linked.rows[0], {
        google_sub: key + '-sub',
        email_verified: true,
      });
      // Same Google identity after an email change still finds the account.
      assert.equal(
        await linkGoogleAccount({
          sub: key + '-sub',
          email: 'changed-' + email,
          name: '',
        }),
        id,
      );
      // A different Google identity cannot take over the linked email.
      await assert.rejects(
        linkGoogleAccount({ sub: key + '-other', email, name: '' }),
        /სხვა Google/,
      );
      assert.equal(
        await linkGoogleAccount({
          sub: key + '-new',
          email: 'nobody-' + email,
          name: '',
        }),
        null,
      );
    } finally {
      await db().query(
        "DELETE FROM audit_log WHERE action='company.google_linked' AND after_data->>'accountId'=$1",
        [rows[0].id],
      );
      await db().query('DELETE FROM company_accounts WHERE company_key=$1', [
        key,
      ]);
      await db().query('DELETE FROM company_profiles WHERE company_key=$1', [
        key,
      ]);
      await db().end?.();
    }
  },
);
