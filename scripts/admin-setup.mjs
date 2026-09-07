import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
const path = '.env';
const original = existsSync(path)
  ? readFileSync(path, 'utf8')
  : readFileSync('.env.example', 'utf8');
if (/^ADMIN_PASSWORD_HASH=.+$/m.test(original)) {
  console.error(
    'Admin credentials already exist. Keep the existing password; no credentials were changed.',
  );
  process.exit(1);
}
const password = randomBytes(18).toString('base64url');
const salt = randomBytes(16).toString('hex');
const hash = salt + ':' + scryptSync(password, salt, 64).toString('hex');
const result = original
  .replace(/^ADMIN_PASSWORD_HASH=.*$/m, 'ADMIN_PASSWORD_HASH=' + hash)
  .replace(
    /^SESSION_SECRET=.*$/m,
    'SESSION_SECRET=' + randomBytes(48).toString('hex'),
  );
writeFileSync(path, result, { mode: 0o600 });
mkdirSync('.local', { recursive: true });
writeFileSync(
  '.local/admin-access.txt',
  `Local admin: http://localhost:3000/admin\nPassword: ${password}\n`,
  { mode: 0o600 },
);
console.log(
  'Admin credentials saved to .local/admin-access.txt. The file is ignored by Git.',
);
