import { z } from 'zod';
import { db, transaction } from './db';
import { ApiError } from './auth';
import {
  candidatePairs,
  employerIdentity,
  employerSlug,
  mergedIdentities,
} from '../employer-identity';

export type EmployerName = { name: string; count: number };
export type EmployerCandidate = {
  a: string;
  b: string;
  left: EmployerName[];
  right: EmployerName[];
};

/* Every published employer under its identity, with a person's merges applied. Persons on ss.ge
   and placeholder names have no identity and are left out. */
export async function employerDirectory() {
  const [{ rows }, decisions] = await Promise.all([
    db().query(
      `SELECT btrim(j.published->>'company') AS name,
              COALESCE(j.published->>'logoUrl','')<>'' AS logo,
              count(DISTINCT j.id)::int AS n,
              array_agg(DISTINCT si.source_id) AS sources
         FROM jobs j JOIN source_items si ON si.job_id=j.id
        WHERE j.status='published' AND COALESCE(j.published->>'company','')<>''
        GROUP BY 1,2`,
    ),
    db().query('SELECT a,b,decision FROM employer_decisions'),
  ]);
  const root = mergedIdentities(
    decisions.rows
      .filter((d) => d.decision === 'merge')
      .map((d) => [d.a, d.b] as const),
  );
  const own = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const id = employerIdentity(r.name, r.sources, r.logo);
    if (!id) continue;
    const names = own.get(id) || new Map<string, number>();
    names.set(r.name, (names.get(r.name) || 0) + r.n);
    own.set(id, names);
  }
  return { own, root, decisions: decisions.rows as { a: string; b: string }[] };
}

const list = (names?: Map<string, number>) =>
  [...(names || [])]
    .map(([name, count]) => ({ name, count }))
    .sort((x, y) => y.count - x.count);

/* Near spellings nobody has answered yet, largest first, without pairs already joined. */
export async function employerCandidates(limit = 60) {
  const { own, root, decisions } = await employerDirectory();
  const answered = new Set(decisions.map((d) => `${d.a}\n${d.b}`));
  const total = (id: string) =>
    [...(own.get(id)?.values() || [])].reduce((s, n) => s + n, 0);
  return candidatePairs([...own.keys()])
    .filter(([a, b]) => !answered.has(`${a}\n${b}`) && root(a) !== root(b))
    .sort((x, y) => total(y[0]) + total(y[1]) - total(x[0]) - total(x[1]))
    .slice(0, limit)
    .map(([a, b]) => ({
      a,
      b,
      left: list(own.get(a)),
      right: list(own.get(b)),
    }));
}

const decisionSchema = z.object({
  a: z.string().min(1).max(300),
  b: z.string().min(1).max(300),
  decision: z.enum(['merge', 'separate']),
});
export async function decideEmployers(input: unknown) {
  const data = decisionSchema.parse(input);
  if (data.a === data.b) throw new ApiError('ორივე მხარე ერთი სახელია');
  const [a, b] = data.a < data.b ? [data.a, data.b] : [data.b, data.a];
  await transaction(async (c) => {
    const before = (
      await c.query(
        'SELECT * FROM employer_decisions WHERE a=$1 AND b=$2 FOR UPDATE',
        [a, b],
      )
    ).rows[0];
    await c.query(
      `INSERT INTO employer_decisions(a,b,decision) VALUES($1,$2,$3)
       ON CONFLICT (a,b) DO UPDATE SET decision=excluded.decision, decided_at=now()`,
      [a, b, data.decision],
    );
    await c.query(
      'INSERT INTO audit_log(action,actor,before_data,after_data) VALUES($1,$2,$3,$4)',
      [
        'employer.decide',
        'admin',
        before || null,
        { a, b, decision: data.decision },
      ],
    );
  });
  return { a, b, decision: data.decision };
}

/* Keep existing company URLs available, but link from cards only when useful to browse. */
export const employerPageMinimum = 1;
export type EmployerPage = {
  slug: string;
  name: string;
  logoUrl: string;
  names: string[];
  jobIds: string[];
  cities: { name: string; count: number }[];
};

// Aggregate repeated employer attributes in PostgreSQL; only job IDs repeat on the wire.
export const employerRowsSql = `SELECT name,logo,city,sources,array_agg(id ORDER BY id) AS ids
         FROM (SELECT j.id::text AS id, btrim(j.published->>'company') AS name,
              COALESCE(j.published->>'logoUrl','') AS logo, btrim(COALESCE(j.published->>'city','')) AS city,
              array_agg(DISTINCT si.source_id) AS sources
         FROM jobs j JOIN source_items si ON si.job_id=j.id JOIN sources s ON s.id=si.source_id AND NOT s.retired
        WHERE j.status='published' AND COALESCE(j.published->>'company','')<>''
          AND (COALESCE(j.published->>'deadline','')='' OR j.published->>'deadline' >= to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD'))
        GROUP BY j.id) visible_employers
        GROUP BY name,logo,city,sources ORDER BY min(id)`;

async function buildEmployerPages() {
  const [{ rows }, decisions] = await Promise.all([
    db().query(employerRowsSql),
    db().query("SELECT a,b FROM employer_decisions WHERE decision='merge'"),
  ]);
  const root = mergedIdentities(decisions.rows.map((d) => [d.a, d.b] as const));
  type Group = {
    ids: string[];
    names: Map<string, number>;
    cities: Map<string, number>;
    logo: string;
  };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const identity = employerIdentity(r.name, r.sources, Boolean(r.logo));
    if (!identity) continue;
    const key = root(identity);
    const g: Group = groups.get(key) || {
      ids: [],
      names: new Map(),
      cities: new Map(),
      logo: '',
    };
    g.ids.push(...r.ids);
    g.names.set(r.name, (g.names.get(r.name) || 0) + r.ids.length);
    // Sources put a street address after the town ("რუსთავი, შარტავას #3"); the town is what counts.
    const city = String(r.city).split(',')[0].trim();
    if (city) g.cities.set(city, (g.cities.get(city) || 0) + r.ids.length);
    g.logo ||= r.logo;
    groups.set(key, g);
  }
  const ranked = (m: Map<string, number>) =>
    [...m]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const bySlug = new Map<string, EmployerPage>();
  const byJob = new Map<string, string>();
  // Largest first, so when two employers would share an address the larger keeps the plain one.
  for (const [identity, g] of [...groups]
    .filter(([, g]) => g.ids.length >= employerPageMinimum)
    .sort(
      (a, b) => b[1].ids.length - a[1].ids.length || a[0].localeCompare(b[0]),
    )) {
    const names = ranked(g.names);
    const base = employerSlug(names[0].name) || identity;
    let slug = base;
    for (let n = 2; bySlug.has(slug); n++) slug = `${base}-${n}`;
    bySlug.set(slug, {
      slug,
      name: names[0].name,
      logoUrl: g.logo,
      names: names.map((x) => x.name),
      jobIds: g.ids,
      cities: ranked(g.cities).slice(0, 8),
    });
    if (g.ids.length >= 3) {
      for (const id of g.ids) byJob.set(id, slug);
    }
  }
  return { bySlug, byJob };
}

let pages: { at: number; value: ReturnType<typeof buildEmployerPages> } | null =
  null;
/* Rebuilt at most every ten minutes per server instance: new vacancies arrive on a cycle of that
   order, and a failed build is forgotten at once so the next request tries again. */
export function employerPages() {
  if (!pages || Date.now() - pages.at > 600000) {
    const value = buildEmployerPages().catch((error) => {
      pages = null;
      throw error;
    });
    pages = { at: Date.now(), value };
  }
  return pages.value;
}

/* For a page that only links to an employer: never waits for a cold directory. The first caller
   starts the build and renders without the link; later ones get it. */
export async function employerPagesIfReady() {
  const fresh = pages && Date.now() - pages.at <= 600000 ? pages.value : null;
  if (!fresh) {
    employerPages().catch(() => {});
    return null;
  }
  const settled = await Promise.race([
    fresh.then((v) => v).catch(() => null),
    new Promise<undefined>((r) => setTimeout(r, 0)),
  ]);
  return settled || null;
}
