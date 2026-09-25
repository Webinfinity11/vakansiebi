/* Tbilisi metro stations, in travel order along each line.

   Source: OpenStreetMap, Overpass API, 2026-09-25 — nodes tagged station=subway inside the
   bounding box 41.64,44.70,41.80,44.90 (23 nodes, network "თბილისის მეტროპოლიტენი"). Names are
   the stations' own Georgian names as OSM carries them (name:ka), which match the metro's signs.

   The real network: line 1 (ახმეტელი-ვარკეთილის) has 16 stations, line 2 (საბურთალოს) has 7 —
   23 in all. The one interchange, სადგურის მოედანი, is two stations with two platforms and two
   names on the metro's own map (სადგურის მოედანი-1 / -2), so it is listed once per line: each
   line shows its own station and URL, and neither line looks one stop short. */

export type MetroLine = 1 | 2;
export type MetroStation = {
  slug: string;
  name: string;
  line: MetroLine;
  lat: number;
  lon: number;
};

export const metroLines: Record<MetroLine, { name: string; short: string }> = {
  1: { name: 'ახმეტელი-ვარკეთილის ხაზი', short: 'I ხაზი' },
  2: { name: 'საბურთალოს ხაზი', short: 'II ხაზი' },
};

export const metroStations: MetroStation[] = [
  {
    slug: 'akhmeteli-theatre',
    name: 'ახმეტელის თეატრი',
    line: 1,
    lat: 41.791056,
    lon: 44.814998,
  },
  {
    slug: 'sarajishvili',
    name: 'სარაჯიშვილი',
    line: 1,
    lat: 41.784058,
    lon: 44.799918,
  },
  {
    slug: 'guramishvili',
    name: 'გურამიშვილი',
    line: 1,
    lat: 41.775765,
    lon: 44.79558,
  },
  {
    slug: 'ghrmaghele',
    name: 'ღრმაღელე',
    line: 1,
    lat: 41.764974,
    lon: 44.78996,
  },
  { slug: 'didube', name: 'დიდუბე', line: 1, lat: 41.749452, lon: 44.779994 },
  {
    slug: 'gotsiridze',
    name: 'გოცირიძე',
    line: 1,
    lat: 41.74294,
    lon: 44.784045,
  },
  {
    slug: 'nadzaladevi',
    name: 'ნაძალადევი',
    line: 1,
    lat: 41.733404,
    lon: 44.796426,
  },
  {
    slug: 'station-square-1',
    name: 'სადგურის მოედანი-1',
    line: 1,
    lat: 41.722544,
    lon: 44.797769,
  },
  {
    slug: 'marjanishvili',
    name: 'მარჯანიშვილი',
    line: 1,
    lat: 41.709594,
    lon: 44.796875,
  },
  {
    slug: 'rustaveli',
    name: 'რუსთაველი',
    line: 1,
    lat: 41.703497,
    lon: 44.789647,
  },
  {
    slug: 'liberty-square',
    name: 'თავისუფლების მოედანი',
    line: 1,
    lat: 41.694525,
    lon: 44.800563,
  },
  {
    slug: 'avlabari',
    name: 'ავლაბარი',
    line: 1,
    lat: 41.692259,
    lon: 44.815841,
  },
  {
    slug: '300-aragveli',
    name: '300 არაგველი',
    line: 1,
    lat: 41.687995,
    lon: 44.826233,
  },
  { slug: 'isani', name: 'ისანი', line: 1, lat: 41.686625, lon: 44.839963 },
  { slug: 'samgori', name: 'სამგორი', line: 1, lat: 41.685518, lon: 44.854483 },
  {
    slug: 'varketili',
    name: 'ვარკეთილი',
    line: 1,
    lat: 41.691897,
    lon: 44.870885,
  },
  {
    slug: 'station-square-2',
    name: 'სადგურის მოედანი-2',
    line: 2,
    lat: 41.722578,
    lon: 44.796442,
  },
  {
    slug: 'tsereteli',
    name: 'წერეთელი',
    line: 2,
    lat: 41.726412,
    lon: 44.787661,
  },
  {
    slug: 'technical-university',
    name: 'ტექნიკური უნივერსიტეტი',
    line: 2,
    lat: 41.720349,
    lon: 44.776643,
  },
  {
    slug: 'medical-university',
    name: 'სამედიცინო უნივერსიტეტი',
    line: 2,
    lat: 41.727279,
    lon: 44.76384,
  },
  { slug: 'delisi', name: 'დელისი', line: 2, lat: 41.725487, lon: 44.745341 },
  {
    slug: 'vazha-pshavela',
    name: 'ვაჟა-ფშაველა',
    line: 2,
    lat: 41.724034,
    lon: 44.730853,
  },
  {
    slug: 'state-university',
    name: 'სახელმწიფო უნივერსიტეტი',
    line: 2,
    lat: 41.722825,
    lon: 44.718511,
  },
];

export const stationBySlug = (slug: string | undefined) =>
  slug ? metroStations.find((s) => s.slug === slug) : undefined;

export const metroPath = (s: MetroStation) => `/metro?station=${s.slug}`;

/** The walks a station page offers; the page loads everything within the longest. */
export const metroWalkChoices = [5, 10, 15] as const;
export const metroMaxWalk = 15;
/** The walk the station overview counts with, and the one a station page opens on. */
export const metroDefaultWalk = 10;
