import { redirect } from 'next/navigation';
import {
  metroPath,
  metroWalkChoices,
  stationBySlug,
} from '@/lib/tbilisi-metro';

// Existing bookmarks keep their station; the metro experience now lives on the map.
export default async function MetroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const station = stationBySlug(
    typeof params.station === 'string' ? params.station : '',
  );
  const walk = Number(params.walk);
  const target = station ? metroPath(station) : '/map';
  redirect(
    station && (metroWalkChoices as readonly number[]).includes(walk)
      ? `${target}&walk=${walk}`
      : target,
  );
}
