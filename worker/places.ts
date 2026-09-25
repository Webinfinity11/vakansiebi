import { setTimeout as delay } from 'node:timers/promises';
import { db } from '../lib/server/db';
import { geocode, type Geocoded } from '../lib/server/geocode';
import { streetAddresses } from '../lib/street-address';
import { sourcePoint } from '../lib/source-point';
import { vacancySummary } from '../lib/vacancy-summary';
import type { Vacancy } from '../lib/types';

/* Puts published vacancies with a precise street address on the map.

   Nominatim is free at one request a second with every answer cached, so each run asks at
   most `lookups` new addresses and waits between them; everything already asked comes from
   geocode_cache. A vacancy is read once per address text: job_place_checks remembers what was
   read, so an unchanged vacancy costs nothing on the next run. */
export const placeRunLimits = { vacancies: 400, lookups: 60, pauseMs: 1100 };

export async function placeVacancies({
  vacancies = placeRunLimits.vacancies,
  lookups = placeRunLimits.lookups,
  pauseMs = placeRunLimits.pauseMs,
  lookup = geocode,
}: {
  vacancies?: number;
  lookups?: number;
  pauseMs?: number;
  lookup?: typeof geocode;
} = {}) {
  // No lock: the production database is reached through a transaction pooler, where a session
  // lock is unreliable, and every write below is idempotent — two runs at once only ask twice.
  let asked = 0;
  let placed = 0;
  let failures = 0;
  {
    const { rows } = await db().query<{
      id: string;
      published: Vacancy;
      source: string | null;
    }>(
      `SELECT j.id, j.published, c.source
       FROM jobs j LEFT JOIN job_place_checks c ON c.job_id = j.id
       WHERE j.status = 'published' AND j.published IS NOT NULL
         AND (c.job_id IS NULL OR c.checked_at < now() - interval '7 days')
       ORDER BY (c.job_id IS NULL) DESC, j.published_at DESC NULLS LAST
       LIMIT $1`,
      [vacancies],
    );
    // Unchanged vacancies are marked read too, or the same rows would fill every run's batch.
    const unchanged: string[] = [];
    for (const row of rows) {
      const text =
        vacancySummary(row.published).find((item) => item.label === 'მისამართი')
          ?.value ?? '';
      // A pin the source published is part of what was read: a moved pin is read again.
      const point = sourcePoint(row.published);
      const read = point ? `${text} @${point.lat},${point.lon}` : text;
      if (row.source === read) {
        unchanged.push(row.id);
        continue;
      }
      const addresses = text
        ? streetAddresses(text, row.published.city || '')
        : [];
      const found: {
        query: string;
        lat: number;
        lon: number;
        label: string;
      }[] = [];
      let complete = true;
      for (const address of addresses) {
        const cached = (
          await db().query<{
            status: Geocoded['status'];
            lat: number;
            lon: number;
            label: string;
          }>(
            'SELECT status, lat, lon, label FROM geocode_cache WHERE query = $1',
            [address.query],
          )
        ).rows[0];
        let answer: Geocoded | undefined = cached
          ? cached.status === 'exact'
            ? {
                status: 'exact',
                lat: cached.lat,
                lon: cached.lon,
                label: cached.label,
              }
            : { status: cached.status }
          : undefined;
        if (!answer) {
          if (asked >= lookups) {
            complete = false; // come back to this vacancy on the next run
            break;
          }
          if (asked) await delay(pauseMs);
          asked++;
          try {
            answer = await lookup(address);
            failures = 0;
          } catch (error) {
            // A dropped connection is not an answer: nothing is cached, the vacancy is read again
            // next time, and a run that keeps failing stops instead of hammering the service.
            complete = false;
            if (++failures >= 3) throw error;
            break;
          }
          await db().query(
            `INSERT INTO geocode_cache(query, status, lat, lon, label) VALUES($1, $2, $3, $4, $5)
             ON CONFLICT (query) DO UPDATE SET status = $2, lat = $3, lon = $4, label = $5, checked_at = now()`,
            [
              address.query,
              answer.status,
              answer.status === 'exact' ? answer.lat : null,
              answer.status === 'exact' ? answer.lon : null,
              answer.status === 'exact' ? answer.label : null,
            ],
          );
        }
        if (answer.status === 'exact')
          found.push({
            query: address.query,
            lat: answer.lat,
            lon: answer.lon,
            label: answer.label,
          });
      }
      if (!complete) continue;
      /* The building the geocoder matches comes first: an employer's pin on a board map was
         seen 250 m from the building the geocoder matched to that same vacancy's address. The
         pin places the vacancy only when the written address cannot — no house number, or a
         street the geocoder finds twice or not at all. */
      if (point && !found.length)
        found.push({
          query: `pin:${point.lat},${point.lon}`,
          ...point,
          label: sourcePointLabel(addresses, text, row.published.city),
        });
      await db().query('DELETE FROM job_places WHERE job_id = $1', [row.id]);
      for (const place of found)
        await db().query(
          'INSERT INTO job_places(job_id, query, lat, lon, label) VALUES($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
          [row.id, place.query, place.lat, place.lon, place.label],
        );
      placed += found.length;
      await db().query(
        `INSERT INTO job_place_checks(job_id, source) VALUES($1, $2)
         ON CONFLICT (job_id) DO UPDATE SET source = $2, checked_at = now()`,
        [row.id, read],
      );
    }
    if (unchanged.length)
      await db().query(
        'UPDATE job_place_checks SET checked_at = now() WHERE job_id = ANY($1::uuid[])',
        [unchanged],
      );
    return { asked, placed };
  }
}

/** What a source's pin is called on the map: its one street address, else the written text. */
export function sourcePointLabel(
  addresses: { street: string; number: string; city: string }[],
  text: string,
  city: string,
) {
  if (addresses.length === 1) {
    const [a] = addresses;
    return `${a.street} ${a.number}, ${a.city}`;
  }
  return (text || city).slice(0, 200);
}
