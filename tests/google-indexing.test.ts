import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import {
  createGoogleIndexing,
  deletionAllowed,
  indexingDailyLimit,
  indexingJwt,
  indexingTransition,
} from '../lib/server/google-indexing';

// Ephemeral test-only material: no key literal, file, service account, or network.
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const key = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const settings = {
  GOOGLE_INDEXING_CLIENT_EMAIL: 'test@example.invalid',
  GOOGLE_INDEXING_PRIVATE_KEY: key,
};
const url =
  'https://jobx.ge/vacancies/developer-11111111-1111-4111-8111-111111111111';
const tokenUrl = 'https://oauth2.googleapis.com/token';
const publishUrl =
  'https://indexing.googleapis.com/v3/urlNotifications:publish';

void test('indexing JWT has RS256 claims, a one-hour expiry and a verifiable signature', () => {
  const jwt = indexingJwt(
    settings.GOOGLE_INDEXING_CLIENT_EMAIL,
    key.replaceAll('\n', '\\n'),
    1700000000000,
  );
  const [header, payload, signature] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url').toString()), {
    alg: 'RS256',
    typ: 'JWT',
  });
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url').toString()), {
    iss: 'test@example.invalid',
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: tokenUrl,
    iat: 1700000000,
    exp: 1700003600,
  });
  assert.ok(
    verify(
      'RSA-SHA256',
      Buffer.from(`${header}.${payload}`),
      publicKey,
      Buffer.from(signature, 'base64url'),
    ),
  );
});

void test('missing either credential silently disables networking and database access', async () => {
  for (const env of [
    {},
    { GOOGLE_INDEXING_CLIENT_EMAIL: 'test@example.invalid' },
    { GOOGLE_INDEXING_PRIVATE_KEY: key },
  ]) {
    const api = createGoogleIndexing({
      env: () => env,
      request: async () => {
        assert.fail('network called');
      },
      reserve: async () => {
        assert.fail('database called');
      },
      warn: () => {
        assert.fail('disabled should be silent');
      },
    });
    await api.publish(url, 'URL_UPDATED');
    await api.publish(url, 'URL_DELETED');
  }
});

void test('daily limit defaults to 200, accepts zero and rejects malformed values', () => {
  for (const value of [
    undefined,
    '',
    ' ',
    '-1',
    'NaN',
    '1.5',
    'Infinity',
    '2147483648',
  ])
    assert.equal(indexingDailyLimit(value), 200);
  assert.equal(indexingDailyLimit('0'), 0);
  assert.equal(indexingDailyLimit('350'), 350);
});

void test('deletion requires 404/410 or an actual robots noindex meta element on 200', () => {
  for (const status of [404, 410])
    assert.equal(deletionAllowed(status, ''), true);
  assert.equal(
    deletionAllowed(200, '<meta content="NOINDEX, follow" name="ROBOTS">'),
    true,
  );
  for (const html of [
    '<meta name="robots" content="index,follow">',
    '<p>noindex</p>',
    '<script>"<meta name=robots content=noindex>"</script>',
    '<meta name="description" content="noindex">',
    '<!-- <meta name="robots" content="noindex"> -->',
  ])
    assert.equal(deletionAllowed(200, html), false);
  for (const status of [301, 302, 403, 429, 500])
    assert.equal(
      deletionAllowed(status, '<meta name="robots" content="noindex">'),
      false,
    );
});

void test('only a new publication generates an event; archival spends nothing', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const live = { status: 'published', published: { title: 'Developer' } };
  const pending = { status: 'pending', published: null };
  const archived = { status: 'archived', published: null };
  assert.deepEqual(indexingTransition(id, pending, live), [
    { url, type: 'URL_UPDATED' },
  ]);
  for (const [before, after] of [
    // Archival is left to the sitemap and the page itself: removals outnumber
    // publications several times over and would eat the whole daily budget.
    [live, archived],
    [live, live],
    [pending, archived],
    [archived, archived],
    [live, { status: 'merged', published: null }],
  ])
    assert.deepEqual(indexingTransition(id, before, after), []);
});

void test('token exchange is shared concurrently, cached and refreshed before expiry', async () => {
  let now = 1700000000000;
  let tokens = 0;
  let sends = 0;
  let reservations = 0;
  const api = createGoogleIndexing({
    env: () => settings,
    now: () => now,
    reserve: async (limit) => {
      assert.equal(limit, 200);
      reservations++;
      return true;
    },
    request: async (input, init) => {
      assert.equal(init?.method, 'POST');
      assert.ok(init?.signal);
      if (input === tokenUrl) {
        tokens++;
        const body = init?.body as URLSearchParams;
        assert.equal(
          body.get('grant_type'),
          'urn:ietf:params:oauth:grant-type:jwt-bearer',
        );
        assert.equal(body.get('assertion')?.split('.').length, 3);
        return Response.json({ access_token: 'fake-token', expires_in: 3600 });
      }
      assert.equal(input, publishUrl);
      assert.deepEqual(JSON.parse(init?.body as string), {
        url,
        type: 'URL_UPDATED',
      });
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'Bearer fake-token',
      );
      sends++;
      return Response.json({});
    },
    warn: (message) => assert.fail(message),
  });
  await Promise.all([
    api.publish(url, 'URL_UPDATED'),
    api.publish(url, 'URL_UPDATED'),
  ]);
  assert.equal(tokens, 1);
  now += 3000000;
  await api.publish(url, 'URL_UPDATED');
  assert.equal(tokens, 1);
  now += 600000;
  await api.publish(url, 'URL_UPDATED');
  assert.equal(tokens, 2);
  assert.equal(sends, 4);
  assert.equal(reservations, 4);
});

void test('live pages and redirects never cause a deletion notification or consume budget', async () => {
  for (const status of [200, 301]) {
    let reads = 0;
    const api = createGoogleIndexing({
      env: () => settings,
      request: async (input, init) => {
        assert.equal(input, url);
        assert.equal(init?.redirect, 'manual');
        reads++;
        return new Response('live page', { status });
      },
      reserve: async () => {
        assert.fail('budget consumed');
      },
      warn: () => assert.fail('precondition skip is silent'),
    });
    await api.publish(url, 'URL_DELETED');
    assert.equal(reads, 1);
  }
});

void test('404, 410 and streamed noindex pages are checked before deletion is sent', async () => {
  for (const status of [404, 410, 200]) {
    const calls: string[] = [];
    const api = createGoogleIndexing({
      env: () => settings,
      reserve: async () => {
        calls.push('budget');
        return true;
      },
      request: async (input, init) => {
        calls.push(input as string);
        if (input === url)
          return new Response('<meta name="robots" content="noindex">', {
            status,
          });
        if (input === tokenUrl)
          return Response.json({
            access_token: 'fake-token',
            expires_in: 3600,
          });
        assert.deepEqual(JSON.parse(init?.body as string), {
          url,
          type: 'URL_DELETED',
        });
        return Response.json({});
      },
      warn: (message) => assert.fail(message),
    });
    await api.publish(url, 'URL_DELETED');
    assert.deepEqual(calls, [url, tokenUrl, 'budget', publishUrl]);
  }
});

void test('exhausted budget silently skips publish; failed attempts are not refunded or retried', async () => {
  for (const allowed of [false, true]) {
    let sends = 0;
    let warnings = 0;
    const api = createGoogleIndexing({
      env: () => settings,
      reserve: async () => allowed,
      request: async (input) => {
        if (input === tokenUrl)
          return Response.json({
            access_token: 'fake-token',
            expires_in: 3600,
          });
        sends++;
        return new Response('', { status: 429 });
      },
      warn: (message) => {
        assert.match(message, /publish HTTP 429/);
        warnings++;
      },
    });
    await api.publish(url, 'URL_UPDATED');
    assert.equal(sends, allowed ? 1 : 0);
    assert.equal(warnings, allowed ? 1 : 0);
  }
});

void test('token, database and network errors fail open without logging response bodies or keys', async () => {
  for (const failure of ['token', 'budget', 'network']) {
    const warnings: string[] = [];
    const api = createGoogleIndexing({
      env: () => settings,
      reserve: async () => {
        if (failure === 'budget') throw new Error('private error');
        return true;
      },
      request: async (input) => {
        if (input === tokenUrl)
          return failure === 'token'
            ? new Response('private response', { status: 401 })
            : Response.json({ access_token: 'fake-token', expires_in: 3600 });
        throw new Error('private error');
      },
      warn: (message) => warnings.push(message),
    });
    await api.publish(url, 'URL_UPDATED');
    assert.equal(warnings.length, 1);
    assert.doesNotMatch(warnings[0], /private|fake-token|BEGIN/);
  }
});

void test('non-vacancy, off-site and preview URLs and zero limit cannot send', async () => {
  const api = createGoogleIndexing({
    env: () => settings,
    request: async () => {
      assert.fail('network called');
    },
    reserve: async () => {
      assert.fail('budget called');
    },
  });
  for (const target of [
    'https://jobx.ge/',
    'https://example.invalid' + new URL(url).pathname,
    url + '?preview=1',
    'https://jobx.ge/vacancies/not-a-uuid',
    url.replace('/vacancies/', '/vacancies/nested/'),
    url.replace('/vacancies/', '/vacancies/nested%2F'),
  ])
    await api.publish(target, 'URL_UPDATED');
  await createGoogleIndexing({
    env: () => ({ ...settings, GOOGLE_INDEXING_DAILY_LIMIT: '0' }),
    request: async () => {
      assert.fail('network called');
    },
  }).publish(url, 'URL_UPDATED');
});

void test('deletion precondition HTTP errors are logged and never sent', async () => {
  const warnings: string[] = [];
  const api = createGoogleIndexing({
    env: () => settings,
    request: async (input) => {
      assert.equal(input, url);
      return new Response('', { status: 503 });
    },
    reserve: async () => {
      assert.fail('budget called');
    },
    warn: (message) => warnings.push(message),
  });
  await api.publish(url, 'URL_DELETED');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /deletion precondition HTTP 503/);
});
