// One-time fill of the vacancy map: reads every published vacancy's address and geocodes the
// precise ones, one request a second as Nominatim asks, until nothing is left. Afterwards the
// scheduled worker keeps it current with a few requests per cycle. Safe to stop and rerun:
// answers are cached and finished vacancies are remembered.
import 'dotenv/config';
import { db } from '../lib/server/db';
import { placeVacancies } from '../worker/places';

let round = 0;
for (;;) {
  round++;
  const result = await placeVacancies({ vacancies: 400, lookups: 300 });
  const left = (
    await db().query(
      `SELECT count(*)::int n FROM jobs j LEFT JOIN job_place_checks c ON c.job_id = j.id
       WHERE j.status = 'published' AND c.job_id IS NULL`,
    )
  ).rows[0].n;
  const pins = (
    await db().query('SELECT count(DISTINCT job_id)::int n FROM job_places')
  ).rows[0].n;
  console.log(
    `round ${round}: asked ${result?.asked ?? 0}, vacancies on the map ${pins}, still to read ${left}`,
  );
  if (!left) break;
}
await db().end();
