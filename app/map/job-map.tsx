'use client';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  Map as MapLibre,
  GeoJSONSource,
  MapMouseEvent,
} from 'maplibre-gl';
import {
  Banknote,
  ChevronUp,
  List,
  MapPin,
  MapPinOff,
  Search,
  TrainFront,
  Footprints,
  X,
} from 'lucide-react';
import { trackAction } from '@/lib/analytics-client';
import { Choice } from '../choice';
import { SkeletonRows } from '../skeleton';
import { CompanyLogo } from '../company-logo';
import { compactSalary } from '@/lib/vacancy-presentation';
import { vacancySegment } from '@/lib/vacancy-navigation';
import type { MapVacancy } from '@/lib/server/job-map';
import {
  metroDefaultWalk,
  metroWalkChoices,
  stationBySlug,
  type MetroStation,
} from '@/lib/tbilisi-metro';
import { distanceMeters, formatWalk, walkMinutes } from '@/lib/geo';
import { nearestMetro, vacanciesNearStation } from '@/lib/map-metro';
import {
  addMetroLines,
  addMetroStations,
  frameStation,
  stationHitLayers,
  stationAtPoint,
  updateMetro,
} from './metro-layers';
import { VacancyPanel } from './vacancy-panel';
import { installMapPreviews } from './map-preview';
import {
  addClusterLayoutSources,
  installClusterLayout,
} from './cluster-layout';

/* Free vector tiles with no key and no request limit; labels are switched to Georgian below. */
const styleUrl = 'https://tiles.openfreemap.org/styles/positron';
const cities: [string, [number, number], number][] = [
  ['თბილისი', [44.793, 41.715], 11.3],
  ['ბათუმი', [41.636, 41.642], 12.4],
  ['ქუთაისი', [42.699, 42.263], 12.4],
];
const listLimit = 80;
/* A cluster this small opens as a list: zooming in again and again to count a handful of pins
   is work the map can do for the reader. A larger one zooms in, as before. */
const groupLimit = 12;
const whole = new Intl.NumberFormat('ka-GE');

type Bounds = [number, number, number, number] | null;
const inBounds = (v: MapVacancy, b: Bounds) =>
  !b ||
  v.places.some(
    ([lat, lon]) => lon >= b[0] && lat >= b[1] && lon <= b[2] && lat <= b[3],
  );
const href = (v: MapVacancy) =>
  `/vacancies/${encodeURIComponent(vacancySegment(v))}`;

function MetroDistance({
  place,
  station,
}: {
  place: MapVacancy['places'][number] | undefined;
  station?: MetroStation;
}) {
  if (!place) return null;
  const near = station
    ? {
        station,
        minutes: walkMinutes(
          distanceMeters(station.lat, station.lon, place[0], place[1]),
        ),
      }
    : nearestMetro(place);
  if (!near) return null;
  return (
    <span
      className="job-map-walk-time"
      title={`მიახლოებითი სავალი დრო მეტროდან მისამართამდე: ${place[2]}`}
    >
      <TrainFront size={13} aria-hidden="true" />
      <span>
        მეტრო {near.station.name} · ≈{formatWalk(near.minutes)}
      </span>
    </span>
  );
}

function features(list: MapVacancy[]) {
  return {
    type: 'FeatureCollection' as const,
    features: list.flatMap((v) =>
      v.places.map(([lat, lon, label], i) => ({
        type: 'Feature' as const,
        id:
          `${v.id}:${i}`
            .split('')
            .reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) >>> 0,
        geometry: { type: 'Point' as const, coordinates: [lon, lat] },
        properties: { job: v.id, label, premium: v.premium ? 1 : 0 },
      })),
    ),
  };
}

export function JobMap() {
  const params = useSearchParams();
  const station = stationBySlug(params.get('station') || '');
  const requestedWalk = Number(params.get('walk'));
  const walk = (metroWalkChoices as readonly number[]).includes(requestedWalk)
    ? requestedWalk
    : metroDefaultWalk;
  const [detail, setDetail] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLElement>(null);
  const map = useRef<MapLibre | null>(null);
  const [all, setAll] = useState<MapVacancy[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [paid, setPaid] = useState(false);
  const [bounds, setBounds] = useState<Bounds>(null);
  const [active, setActive] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const sheetOpen = useRef(false);
  const returnToList = useRef(false);
  const [pagination, setPagination] = useState<{
    list: MapVacancy[];
    limit: number;
  } | null>(null);
  useEffect(() => {
    sheetOpen.current = sheet;
  }, [sheet]);
  const [ready, setReady] = useState(false);
  // The city chip the map was last sent to; a pan or zoom by hand clears it.
  const [city, setCity] = useState<string | null>(null);
  // The vacancies of a small cluster the reader tapped, listed instead of zoomed into.
  const [group, setGroup] = useState<string[] | null>(null);
  // Where the last tap on the map landed, for the ripple that answers it.
  const [ripple, setRipple] = useState<{ x: number; y: number; n: number }>();
  const [beacon, setBeacon] = useState<{
    x: number;
    y: number;
    id: string;
  } | null>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: 0 });
  }, [group, station]);
  const pickStation = useCallback((slug: string) => {
    const url = new URL(window.location.href);
    if (stationBySlug(slug)) {
      url.searchParams.set('station', slug);
      trackAction('metro_station');
    } else {
      url.searchParams.delete('station');
      url.searchParams.delete('walk');
    }
    window.history.replaceState(null, '', url.pathname + url.search);
    setDetail(null);
    setActive(null);
    setGroup(null);
    setCity(null);
    if (slug && matchMedia('(max-width: 900px)').matches) setSheet(true);
  }, []);
  const openVacancy = useCallback((id: string) => {
    returnToList.current = sheetOpen.current;
    setActive(id);
    setDetail(id);
    setSheet(false);
    trackAction('map_open');
  }, []);
  const closeVacancy = useCallback(() => {
    setDetail(null);
    setSheet(returnToList.current);
  }, []);

  // Once per visit: that the map page itself was opened.
  useEffect(() => trackAction('map_page'), []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/map', { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw Error(body.error || 'რუკა ვერ ჩაიტვირთა');
        setAll(body.vacancies);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => controller.abort();
  }, [attempt]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (all ?? []).filter(
      (v) =>
        (!q || `${v.title} ${v.company}`.toLowerCase().includes(q)) &&
        (!category || v.category === category) &&
        (!paid || !!v.salary),
    );
    return station ? vacanciesNearStation(matches, station, walk) : matches;
  }, [all, query, category, paid, station, walk]);
  const categories = useMemo(() => {
    const count = new Map<string, number>();
    for (const v of all ?? [])
      if (v.category) count.set(v.category, (count.get(v.category) ?? 0) + 1);
    return [...count].sort((a, b) => b[1] - a[1]);
  }, [all]);
  const visible = useMemo(
    () => filtered.filter((v) => inBounds(v, bounds)),
    [filtered, bounds],
  );
  const byId = useMemo(
    () => new Map(filtered.map((v) => [v.id, v])),
    [filtered],
  );
  const latestVacancies = useRef(byId);
  useEffect(() => {
    latestVacancies.current = byId;
  }, [byId]);
  const selected = active ? byId.get(active) : undefined;
  const opened = detail ? byId.get(detail) : undefined;
  /* The phone's card rail: what the map shows, nearest to its centre first, with the opened
     vacancy always on it. */
  const grouped = useMemo(
    () =>
      group
        ? group
            .map((id) => byId.get(id))
            .filter((v): v is MapVacancy => !!v && filtered.includes(v))
        : null,
    [group, byId, filtered],
  );
  const nearby = useMemo(() => {
    if (grouped?.length) return grouped;
    if (!bounds) return visible.slice(0, 25);
    const cx = (bounds[0] + bounds[2]) / 2;
    const cy = (bounds[1] + bounds[3]) / 2;
    const dist = (v: MapVacancy) =>
      Math.min(
        ...v.places.map(([lat, lon]) => (lat - cy) ** 2 + (lon - cx) ** 2),
      );
    const list = [...visible].sort((a, b) => dist(a) - dist(b)).slice(0, 25);
    if (selected && !list.some((v) => v.id === selected.id))
      list.unshift(selected);
    return list;
  }, [grouped, visible, bounds, selected]);
  const rail = useRef<HTMLDivElement>(null);
  const railMoved = useRef(false);
  const railTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(railTimer.current), []);
  useEffect(() => {
    clearTimeout(railTimer.current);
  }, [detail]);
  // A pin tapped on the map brings its card to the middle of the rail.
  useEffect(() => {
    if (!active || railMoved.current) {
      railMoved.current = false;
      return;
    }
    rail.current
      ?.querySelector<HTMLElement>(`[data-id="${active}"]`)
      ?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
  }, [active]);
  /* Swiping the rail picks the card that settles in the middle and pans the map to its pin,
     keeping the pin clear of the rail. */
  const onRailScroll = () => {
    clearTimeout(railTimer.current);
    railTimer.current = setTimeout(() => {
      const box = rail.current;
      if (!box) return;
      const mid = box.getBoundingClientRect().left + box.clientWidth / 2;
      let best: HTMLElement | null = null;
      let gap = Infinity;
      for (const el of box.querySelectorAll<HTMLElement>('[data-id]')) {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mid);
        if (d < gap) [gap, best] = [d, el];
      }
      const id = best?.dataset.id;
      const v = id ? byId.get(id) : undefined;
      if (!v || id === active) return;
      railMoved.current = true;
      setActive(id!);
      trackAction('map_card');
      const [lat, lon] = v.places[0];
      map.current?.easeTo({
        center: [lon, lat],
        padding: { top: 0, bottom: 190, left: 0, right: 0 },
      });
    }, 140);
  };

  // The map is created once; data and highlight changes are pushed into it below.
  useEffect(() => {
    if (!box.current) return;
    let cancelled = false;
    void import('maplibre-gl').then((maplibre) => {
      if (cancelled || !box.current) return;
      // Served from public/ by scripts/copy-maplibre-worker.mjs: bundlers cannot follow the
      // library's own computed worker URL.
      maplibre.setWorkerUrl(
        `/vendor/maplibre/${maplibre.getVersion()}/maplibre-gl-worker.mjs`,
      );
      const m = new maplibre.Map({
        container: box.current,
        style: styleUrl,
        center: cities[0][1],
        zoom: cities[0][2],
        minZoom: 6,
        maxBounds: [
          [39.5, 40.9],
          [47.2, 43.8],
        ],
        attributionControl: { compact: true },
        locale: {
          'NavigationControl.ZoomIn': 'გადიდება',
          'NavigationControl.ZoomOut': 'დაპატარავება',
          'GeolocateControl.FindMyLocation': 'ჩემი მდებარეობა',
          'GeolocateControl.LocationNotAvailable': 'მდებარეობა მიუწვდომელია',
          'AttributionControl.ToggleAttribution': 'რუკის წყაროები',
        },
      });
      map.current = m;
      m.addControl(
        new maplibre.NavigationControl({ showCompass: false }),
        'bottom-right',
      );
      const locate = new maplibre.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
      });
      locate.on('geolocate', () => trackAction('map_locate'));
      m.addControl(locate, 'bottom-right');
      m.on('load', () => {
        // Street and place names in Georgian where OpenStreetMap has them.
        for (const layer of m.getStyle().layers)
          if (
            layer.type === 'symbol' &&
            m.getLayoutProperty(layer.id, 'text-field')
          )
            m.setLayoutProperty(layer.id, 'text-field', [
              'coalesce',
              ['get', 'name:ka'],
              ['get', 'name:nonlatin'],
              ['get', 'name'],
            ]);
        addMetroLines(m);
        m.addSource('jobs', {
          type: 'geojson',
          data: features([]),
          cluster: true,
          clusterRadius: 44,
          clusterMaxZoom: 15,
        });
        addClusterLayoutSources(m);
        const motion = matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 0
          : 180;
        m.addLayer({
          id: 'cluster-shadow',
          type: 'circle',
          source: 'job-cluster-display',
          filter: ['has', 'point_count'],
          paint: {
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              18,
              10,
              21,
              50,
              25,
            ],
            'circle-color': '#1f3558',
            'circle-opacity': 0.16,
            'circle-blur': 0.65,
            'circle-translate': [0, 3],
            'circle-translate-anchor': 'viewport',
          },
        });
        m.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'job-cluster-display',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#ffffff',
            'circle-opacity': 0.97,
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              14,
              10,
              17,
              50,
              21,
            ],
            'circle-stroke-width': 1.2,
            'circle-stroke-color': '#8da7db',
          },
        });
        m.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'job-cluster-display',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': 12,
            'text-font': ['Noto Sans Bold'],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: { 'text-color': '#244aaf' },
        });
        // A pin is 15px across; a finger needs about 40. This invisible ring takes the taps.
        m.addLayer({
          id: 'point-halo',
          type: 'circle',
          source: 'jobs',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': [
              'case',
              ['boolean', ['feature-state', 'on'], false],
              21,
              11,
            ],
            'circle-color': '#2457e6',
            'circle-opacity': [
              'case',
              ['boolean', ['feature-state', 'on'], false],
              0.14,
              0.06,
            ],
            'circle-radius-transition': { duration: motion },
            'circle-opacity-transition': { duration: motion },
          },
        });
        m.addLayer({
          id: 'points-hit',
          type: 'circle',
          source: 'jobs',
          filter: ['!', ['has', 'point_count']],
          paint: { 'circle-radius': 20, 'circle-opacity': 0 },
        });
        m.addLayer({
          id: 'points',
          type: 'circle',
          source: 'jobs',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': [
              'case',
              ['boolean', ['feature-state', 'on'], false],
              '#1f3f96',
              ['==', ['get', 'premium'], 1],
              '#f2b705',
              '#2457e6',
            ],
            'circle-radius': [
              'case',
              ['boolean', ['feature-state', 'on'], false],
              11,
              7.5,
            ],
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff',
            'circle-radius-transition': { duration: motion },
            'circle-color-transition': { duration: motion },
          },
        });
        addMetroStations(m, pickStation);
        installClusterLayout(m);
        installMapPreviews(m, maplibre.Popup, (id) =>
          latestVacancies.current.get(id),
        );
        // The layout settles after the map is created (fonts, the phone sheet); keep the canvas
        // matched to its box so the first view is where it should be.
        const fit = new ResizeObserver(() => m.resize());
        fit.observe(box.current!);
        m.once('remove', () => fit.disconnect());
        const report = () => {
          const b = m.getBounds();
          setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
        };
        m.on('moveend', report);
        m.on('movestart', () => setBeacon(null));
        m.on('dragstart', () => setCity(null));
        m.on('zoomstart', (e: { originalEvent?: Event }) => {
          if (e.originalEvent) setGroup(null);
        });
        m.on('zoomstart', (e: { originalEvent?: Event }) => {
          if (e.originalEvent) setCity(null);
        });
        report();
        m.on('click', 'clusters', (e: MapMouseEvent) => {
          if (stationAtPoint(m, e.point)) return;
          const f = m.queryRenderedFeatures(e.point, {
            layers: ['clusters'],
          })[0];
          if (!f) return;
          setRipple((r) => ({
            x: e.point.x,
            y: e.point.y,
            n: (r?.n ?? 0) + 1,
          }));
          trackAction('map_cluster');
          const source = m.getSource('jobs') as GeoJSONSource;
          const id = f.properties.cluster_id;
          const center: [number, number] = [
            Number(f.properties.anchorLon),
            Number(f.properties.anchorLat),
          ];
          void source
            .getClusterExpansionZoom(id)
            .then(async (zoom) => {
              // Past the last clustering zoom the pins share one building: zooming cannot part them.
              if (f.properties.point_count > groupLimit && zoom <= 15) {
                setGroup(null);
                m.easeTo({ center, zoom, duration: 650 });
                return;
              }
              const leaves = await source.getClusterLeaves(
                id,
                Number(f.properties.point_count),
                0,
              );
              const ids = [
                ...new Set(leaves.map((l) => String(l.properties?.job))),
              ];
              setActive(null);
              setDetail(null);
              setGroup(ids);
              if (matchMedia('(max-width: 900px)').matches) setSheet(true);
              railMoved.current = false;
              rail.current?.scrollTo({ left: 0 });
            })
            .catch(() => {
              /* Filters can replace the clustered source mid-request. */
            });
        });
        m.on('click', 'points-hit', (e: MapMouseEvent) => {
          if (stationAtPoint(m, e.point)) return;
          if (m.queryRenderedFeatures(e.point, { layers: ['clusters'] }).length)
            return;
          const f = m.queryRenderedFeatures(e.point, {
            layers: ['points', 'points-hit'],
          })[0];
          if (f) {
            setGroup(null);
            setRipple((r) => ({
              x: e.point.x,
              y: e.point.y,
              n: (r?.n ?? 0) + 1,
            }));
            openVacancy(String(f.properties.job));
            trackAction('map_pin');
          }
        });
        m.on('click', (e: MapMouseEvent) => {
          if (
            !m.queryRenderedFeatures(e.point, {
              layers: ['points', 'points-hit', 'clusters', ...stationHitLayers],
            }).length
          ) {
            setActive(null);
            setDetail(null);
            setGroup(null);
          }
        });
        // The compact attribution starts folded on every screen: a phone has no room for a full line.
        m.getContainer()
          .querySelector('.maplibregl-ctrl-attrib')
          ?.classList.remove('maplibregl-compact-show');
        for (const id of ['points-hit', 'clusters']) {
          m.on(
            'mouseenter',
            id,
            () => (m.getCanvas().style.cursor = 'pointer'),
          );
          m.on('mouseleave', id, () => (m.getCanvas().style.cursor = ''));
        }
        setReady(true);
      });
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [openVacancy, pickStation]);

  useEffect(() => {
    if (!ready || !map.current) return;
    updateMetro(map.current, station, walk);
  }, [ready, station, walk]);

  useEffect(() => {
    if (ready && map.current && station)
      frameStation(map.current, station, walk);
  }, [ready, station, walk]);

  useEffect(() => {
    if (!ready) return;
    void (map.current?.getSource('jobs') as GeoJSONSource | undefined)?.setData(
      features(filtered),
    );
  }, [ready, filtered]);

  // Highlight: the hovered card, or else the opened vacancy, lights its pins.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const lit = new Set(
      hovered ? [hovered] : active ? [active] : (group ?? []),
    );
    m.removeFeatureState({ source: 'jobs' });
    if (!lit.size) return;
    for (const f of features(filtered).features)
      if (lit.has(f.properties.job))
        m.setFeatureState({ source: 'jobs', id: f.id }, { on: true });
  }, [ready, hovered, active, group, filtered]);

  useEffect(() => {
    const m = map.current;
    const id = hovered || active;
    const place =
      id && m
        ? byId
            .get(id)
            ?.places.find(([lat, lon]) => m.getBounds().contains([lon, lat]))
        : undefined;
    if (
      !ready ||
      !m ||
      m.isMoving() ||
      !place ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const point = m.project([place[1], place[0]]);
    const timer = setTimeout(
      () => setBeacon({ x: point.x, y: point.y, id: id! }),
      0,
    );
    return () => clearTimeout(timer);
  }, [ready, hovered, active, byId]);

  const focus = (v: MapVacancy) => {
    trackAction('map_card');
    openVacancy(v.id);
    setSheet(false);
  };

  const listed = group ? (grouped ?? []) : visible;
  const total = filtered.length;
  // A changed area/filter starts a fresh list; opening a detail preserves pagination.
  const shownLimit = pagination?.list === listed ? pagination.limit : listLimit;
  const hasFilters = !!(query.trim() || category || paid || station || group);
  const clearFilters = () => {
    setQuery('');
    setCategory('');
    setPaid(false);
    pickStation('');
  };
  return (
    <div className="job-map" data-detail={!!opened}>
      <div className="job-map-bar">
        <div className="job-map-title">
          <h1>ვაკანსიები რუკაზე</h1>
          {all ? (
            <p>სულ {whole.format(total)} ვაკანსია ზუსტი მისამართით</p>
          ) : (
            <p aria-label="ვაკანსიები იტვირთება">
              <span className="ds-skeleton job-map-count-skeleton" />
            </p>
          )}
        </div>
        <label className="job-map-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            aria-label="პოზიცია ან კომპანია"
            value={query}
            placeholder="პოზიცია ან კომპანია"
            onChange={(e) => setQuery(e.target.value)}
            // Counted once a search is left behind, not on every keystroke.
            onBlur={(e) => {
              if (e.target.value.trim()) trackAction('map_search');
            }}
          />
        </label>
        <fieldset className="job-map-chips" aria-label="ფილტრები">
          {hasFilters && (
            <button type="button" className="ds-chip" onClick={clearFilters}>
              <X aria-hidden="true" /> გასუფთავება
            </button>
          )}
          <button
            type="button"
            className="ds-chip"
            aria-pressed={paid}
            onClick={() => {
              if (!paid) trackAction('map_paid');
              setPaid((v) => !v);
            }}
          >
            <Banknote aria-hidden="true" />
            ხელფასით
          </button>
          <Choice
            label="ყველა მიმართულება"
            value={category || 'ყველა'}
            onChange={(v) => {
              if (v !== 'ყველა') trackAction('map_category');
              setCategory(v === 'ყველა' ? '' : v);
            }}
            options={categories.map(([name]) => name)}
          />
          {cities.map(([name, center, zoom]) => (
            <button
              key={name}
              type="button"
              className="ds-chip"
              aria-pressed={city === name}
              onClick={() => {
                pickStation('');
                setCity(name);
                trackAction('map_city');
                map.current?.easeTo({ center, zoom });
              }}
            >
              <MapPin aria-hidden="true" />
              {name}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="job-map-body">
        <aside ref={list} className="job-map-list" data-open={sheet}>
          <button
            type="button"
            className="job-map-handle"
            aria-expanded={sheet}
            onClick={() => {
              if (!sheet) trackAction('map_sheet');
              setSheet((v) => !v);
            }}
          >
            <span aria-hidden="true" />
            <b>
              {all ? (
                `${whole.format(listed.length)} ვაკანსია ამ ტერიტორიაზე`
              ) : (
                <span className="ds-skeleton job-map-count-skeleton" />
              )}
            </b>
            {sheet ? (
              <X size={16} aria-hidden="true" />
            ) : (
              <ChevronUp size={16} aria-hidden="true" />
            )}
          </button>
          {station && (
            <div className="job-map-station-context">
              <div className="job-map-station-heading">
                <TrainFront size={17} aria-hidden="true" />
                <strong>{station.name}</strong>
                <button
                  type="button"
                  className="ds-btn ds-btn--ghost ds-btn--sm"
                  onClick={() => pickStation('')}
                >
                  ფილტრის მოხსნა
                </button>
              </div>
              <fieldset
                className="job-map-walk"
                aria-label="სავარაუდო სავალი დრო"
              >
                <Footprints size={16} aria-hidden="true" />
                {metroWalkChoices.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className="ds-chip"
                    aria-pressed={walk === minutes}
                    onClick={() => {
                      const url = new URL(window.location.href);
                      url.searchParams.set('walk', String(minutes));
                      window.history.replaceState(
                        null,
                        '',
                        url.pathname + url.search,
                      );
                      setDetail(null);
                      setActive(null);
                      setGroup(null);
                      trackAction('metro_walk');
                    }}
                  >
                    {minutes} წთ
                  </button>
                ))}
              </fieldset>
              <small>ფეხით სავალი დრო მიახლოებითია.</small>
            </div>
          )}

          {group && (
            <div className="job-map-selection">
              <div>
                <strong>
                  {whole.format(listed.length)} ვაკანსია ამ ადგილას
                </strong>
                <span>არჩეული წერტილის შედეგები</span>
              </div>
              <button
                type="button"
                className="ds-btn ds-btn--ghost ds-btn--sm"
                onClick={() => {
                  setGroup(null);
                  setActive(null);
                  setDetail(null);
                }}
              >
                ტერიტორიის სია
              </button>
            </div>
          )}
          {all && !station && !group && (
            <div className="job-map-list-heading">
              <strong>
                {whole.format(listed.length)} ვაკანსია ამ ტერიტორიაზე
              </strong>
            </div>
          )}
          <p className="job-map-hint">
            <MapPin size={14} aria-hidden="true" />
            ნაჩვენებია მხოლოდ ზუსტი მისამართის მქონე ვაკანსიები.
          </p>
          {error && (
            <div className="job-map-error" role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="ds-btn ds-btn--secondary ds-btn--sm"
                onClick={() => {
                  setError('');
                  setAttempt((n) => n + 1);
                }}
              >
                თავიდან ცდა
              </button>
            </div>
          )}
          {!all && !error && (
            <SkeletonRows rows={4} block label="ვაკანსიები იტვირთება" />
          )}
          {all && !listed.length && (
            <div className="job-map-empty">
              <MapPinOff aria-hidden="true" />
              <p>
                {group
                  ? 'არჩეულ ადგილას ამ ფილტრებით ვაკანსია არ ჩანს.'
                  : station
                    ? 'ამ პირობებით ვაკანსია არ ჩანს. გაზარდე სავალი დრო ან აირჩიე სხვა სადგური.'
                    : query.trim() || category || paid
                      ? 'ამ ტერიტორიაზე ამ ფილტრებით ვაკანსია ვერ მოიძებნა.'
                      : 'ამ ტერიტორიაზე ვაკანსია არ ჩანს. დააპატარავე ან გადაიტანე რუკა.'}
              </p>
              {hasFilters && (
                <button
                  type="button"
                  className="ds-btn ds-btn--secondary ds-btn--sm"
                  onClick={clearFilters}
                >
                  ფილტრების გასუფთავება
                </button>
              )}
            </div>
          )}
          <ul className="ds-appear-list">
            {listed.slice(0, shownLimit).map((v) => (
              <li key={v.id} data-active={active === v.id}>
                <button
                  type="button"
                  className="job-map-card"
                  onClick={() => focus(v)}
                  onMouseEnter={() => setHovered(v.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(v.id)}
                  onBlur={() => setHovered(null)}
                >
                  <CompanyLogo company={v.company} url={v.logoUrl} />
                  <span className="job-map-card-text">
                    {v.premium && (
                      <em className="ds-badge ds-badge--warning">პრემიუმი</em>
                    )}
                    <strong>{v.title}</strong>
                    <span>{v.company}</span>
                    <MetroDistance place={v.places[0]} station={station} />
                    {v.salary && (
                      <b>{compactSalary(v.salary, v.salaryPeriod)}</b>
                    )}
                    <small>
                      <MapPin size={14} aria-hidden="true" />
                      {v.places.map((p) => p[2]).join(' · ')}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {listed.length > listLimit && (
            <div className="job-map-more">
              <span aria-live="polite">
                ნაჩვენებია {whole.format(Math.min(shownLimit, listed.length))} /{' '}
                {whole.format(listed.length)}
              </span>
              {listed.length > shownLimit && (
                <button
                  type="button"
                  className="ds-btn ds-btn--secondary"
                  onClick={() =>
                    setPagination({
                      list: listed,
                      limit: shownLimit + listLimit,
                    })
                  }
                >
                  მეტი ვაკანსიის ჩვენება
                </button>
              )}
            </div>
          )}
        </aside>

        <div className="job-map-canvas" data-ready={ready} inert={!!opened}>
          <div ref={box} className="job-map-gl" />
          {beacon && (
            <span
              key={beacon.id}
              className="job-map-beacon"
              style={{ left: beacon.x, top: beacon.y }}
              aria-hidden="true"
            >
              <i />
              <i onAnimationEnd={() => setBeacon(null)} />
            </span>
          )}
          {ripple && (
            <span
              key={`ripple:${ripple.n}`}
              className="job-map-ripple"
              style={{ left: ripple.x, top: ripple.y }}
              aria-hidden="true"
              onAnimationEnd={() => setRipple(undefined)}
            />
          )}
          <button
            type="button"
            className="ds-btn ds-btn--secondary job-map-listbtn"
            onClick={() => {
              trackAction('map_sheet');
              setSheet(true);
            }}
          >
            <List size={16} aria-hidden="true" />
            სია · {whole.format(listed.length)}
          </button>

          {!!nearby.length && (
            <div
              className="job-map-rail"
              data-group={!!grouped?.length}
              key={grouped?.length ? `rail:${group!.join()}` : 'rail'}
              ref={rail}
              onScroll={onRailScroll}
              aria-label="ვაკანსიები რუკის ამ ნაწილში"
            >
              {nearby.map((v) => (
                <article
                  key={v.id}
                  className="job-map-slide"
                  data-id={v.id}
                  data-active={active === v.id}
                >
                  <div className="job-map-slide-head">
                    <CompanyLogo company={v.company} url={v.logoUrl} />
                    <div>
                      {v.premium && (
                        <span className="ds-badge ds-badge--warning">
                          პრემიუმი
                        </span>
                      )}
                      <strong>{v.title}</strong>
                      <span>{v.company}</span>
                    </div>
                  </div>
                  <p>
                    {v.salary && (
                      <b>{compactSalary(v.salary, v.salaryPeriod)}</b>
                    )}
                    <span>
                      <MapPin size={14} aria-hidden="true" />
                      {v.places[0][2]}
                    </span>
                  </p>
                  <MetroDistance place={v.places[0]} station={station} />
                  <a
                    className="ds-btn ds-btn--primary ds-btn--sm"
                    href={href(v)}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
                        return;
                      e.preventDefault();
                      focus(v);
                    }}
                  >
                    ვაკანსიის ნახვა
                  </a>
                </article>
              ))}
            </div>
          )}
        </div>
        {opened && (
          <VacancyPanel
            key={opened.id}
            vacancy={opened}
            onClose={closeVacancy}
          />
        )}
      </div>
    </div>
  );
}
