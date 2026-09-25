import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { PublicHeader } from '../public-header';
import { MetroJobs } from './metro-jobs';
import { shareImage, siteUrl } from '@/lib/seo';
import { distanceMeters } from '@/lib/geo';
import {
  metroDefaultWalk,
  metroLines,
  metroPath,
  metroStations,
  metroWalkChoices,
  stationBySlug,
} from '@/lib/tbilisi-metro';
import { stationCounts, stationVacancies } from '@/lib/server/metro-jobs';
import './metro.css';

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/* One read per request for both the metadata and the page. A failed read leaves the page
   usable — the station list still works — rather than answering with an error. */
const readCounts = cache(async () => {
  try {
    return await stationCounts(metroDefaultWalk);
  } catch {
    return null;
  }
});
const readStation = cache(async (slug: string) => {
  const station = stationBySlug(slug);
  if (!station) return null;
  try {
    return { station, vacancies: await stationVacancies(station) };
  } catch {
    return { station, vacancies: null };
  }
});

/* Not launched yet: reachable by its address for review, but kept out of search results and
   the sitemap, and linked from nowhere on the site. Remove this to launch. */
const unlaunched = { index: false, follow: false } as const;

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const slug = one((await searchParams).station);
  const read = slug ? await readStation(slug) : null;
  if (!read) {
    const title = 'ვაკანსიები მეტროს სადგურთან — JOBX';
    const description =
      'აირჩიე თბილისის მეტროს სადგური და ნახე ვაკანსიები 5, 10 ან 15 წუთის სავალზე — მანძილით, ხელფასით და ზუსტი მისამართით.';
    return {
      title,
      description,
      alternates: { canonical: `${siteUrl}/metro` },
      robots: unlaunched,
      openGraph: {
        images: [shareImage],
        title,
        description,
        url: `${siteUrl}/metro`,
        type: 'website',
        locale: 'ka_GE',
      },
    };
  }
  const { station, vacancies } = read;
  const near = vacancies?.filter((v) => v.minutes <= metroDefaultWalk).length;
  const title = `მეტრო „${station.name}“: ვაკანსიები ფეხით სავალზე — JOBX`;
  const description = [
    `მეტრო „${station.name}“ (${metroLines[station.line].name})`,
    near
      ? `${near} ვაკანსია ${metroDefaultWalk} წუთის სავალზე`
      : `ვაკანსიები ${metroDefaultWalk}–15 წუთის სავალზე`,
    'თითოეულს აქვს მანძილი, ფეხით სავალი დრო, ხელფასი და მისამართი.',
  ].join(' — ');
  const canonical = siteUrl + metroPath(station);
  return {
    title,
    description,
    robots: unlaunched,
    alternates: { canonical },
    openGraph: {
      images: [shareImage],
      title,
      description,
      url: canonical,
      type: 'website',
      locale: 'ka_GE',
    },
  };
}

export default async function MetroPage({ searchParams }: Props) {
  const params = await searchParams;
  const slug = one(params.station);
  const read = slug ? await readStation(slug) : null;
  if (slug && !read) notFound();
  const counts = await readCounts();
  const walkParam = Number(one(params.walk));
  const walk = (metroWalkChoices as readonly number[]).includes(walkParam)
    ? walkParam
    : metroDefaultWalk;

  // For an empty station: the closest other stations, leaving out its own interchange twin,
  // which sits a few steps away and would show the same vacancies.
  const neighbours = read
    ? metroStations
        .filter((s) => s.slug !== read.station.slug)
        .map((s) => ({
          s,
          d: distanceMeters(read.station.lat, read.station.lon, s.lat, s.lon),
        }))
        .filter(({ d }) => d > 300)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map(({ s }) => s.slug)
    : [];

  return (
    <div
      className={`board-shell metro-shell${read ? ' metro-shell--station' : ''}`}
    >
      <PublicHeader />
      <MetroJobs
        key={read?.station.slug ?? ''}
        station={read?.station ?? null}
        vacancies={read?.vacancies ?? null}
        counts={counts}
        neighbours={neighbours}
        initialWalk={walk}
      />
    </div>
  );
}
