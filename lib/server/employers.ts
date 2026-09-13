import { z } from 'zod';
import { db, transaction } from './db';
import { ApiError } from './auth';
import {
  candidatePairs,
  employerIdentity,
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
