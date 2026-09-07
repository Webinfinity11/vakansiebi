import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
if (!existsSync('.env')) {
  console.error(
    'Run npm run admin:setup and configure DATABASE_URL in .env first.',
  );
  process.exit(1);
}
if (existsSync('.local/postgres/PG_VERSION')) {
  const check = spawnSync('pg_ctl', ['-D', '.local/postgres', 'status'], {
    stdio: 'ignore',
  });
  if (check.status !== 0) {
    const start = spawnSync(
      'pg_ctl',
      [
        '-D',
        '.local/postgres',
        '-l',
        '.local/postgres.log',
        '-o',
        '-h 127.0.0.1 -p 55432 -k /tmp',
        'start',
      ],
      { stdio: 'inherit' },
    );
    if (start.status !== 0) process.exit(1);
  }
}
const children = [
  spawn('npm', ['run', 'dev'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'worker'], { stdio: 'inherit' }),
];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill('SIGTERM');
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children)
  child.on('exit', (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  });
