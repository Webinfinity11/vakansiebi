'use client';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Map as MapLibre,
  GeoJSONSource,
  MapMouseEvent,
} from 'maplibre-gl';
import { Banknote, ChevronUp, List, MapPin, Search, X } from 'lucide-react';
import { Choice } from '../choice';
import { CompanyLogo } from '../company-logo';
import { compactSalary } from '@/lib/vacancy-presentation';
import { vacancySegment } from '@/lib/vacancy-navigation';
import type { MapVacancy } from '@/lib/server/job-map';

/* Free vector tiles with no key and no request limit; labels are switched to Georgian below. */
const styleUrl = 'https://tiles.openfreemap.org/styles/positron';
const cities: [string, [number, number], number][] = [
  ['თბილისი', [44.793, 41.715], 11.3],
  ['ბათუმი', [41.636, 41.642], 12.4],
  ['ქუთაისი', [42.699, 42.263], 12.4],
];
const listLimit = 80;
const whole = new Intl.NumberFormat('ka-GE');

type Bounds = [number, number, number, number] | null;
const inBounds = (v: MapVacancy, b: Bounds) =>
  !b ||
  v.places.some(
    ([lat, lon]) => lon >= b[0] && lat >= b[1] && lon <= b[2] && lat <= b[3],
  );
const href = (v: MapVacancy) =>
  `/vacancies/${encodeURIComponent(vacancySegment(v))}`;

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
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const [all, setAll] = useState<MapVacancy[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [paid, setPaid] = useState(false);
  const [bounds, setBounds] = useState<Bounds>(null);
  const [active, setActive] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [ready, setReady] = useState(false);

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
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (all ?? []).filter(
      (v) =>
        (!q || `${v.title} ${v.company}`.toLowerCase().includes(q)) &&
        (!category || v.category === category) &&
        (!paid || !!v.salary),
    );
  }, [all, query, category, paid]);
  const categories = useMemo(() => {
    const count = new Map<string, number>();
    for (const v of all ?? [])
      if (v.category) count.set(v.category, (count.get(v.category) ?? 0) + 1);
    return [...count].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [all]);
  const visible = useMemo(
    () => filtered.filter((v) => inBounds(v, bounds)),
    [filtered, bounds],
  );
  const byId = useMemo(() => new Map((all ?? []).map((v) => [v.id, v])), [all]);
  const selected = active ? byId.get(active) : undefined;

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
      });
      map.current = m;
      m.addControl(
        new maplibre.NavigationControl({ showCompass: false }),
        'bottom-right',
      );
      m.addControl(
        new maplibre.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
        }),
        'bottom-right',
      );
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
        m.addSource('jobs', {
          type: 'geojson',
          data: features([]),
          cluster: true,
          clusterRadius: 44,
          clusterMaxZoom: 15,
        });
        m.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'jobs',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#2457e6',
            'circle-opacity': 0.92,
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              16,
              10,
              20,
              50,
              26,
            ],
            'circle-stroke-width': 3,
            'circle-stroke-color': 'rgba(255,255,255,0.9)',
          },
        });
        m.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'jobs',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-size': 13,
            'text-font': ['Noto Sans Bold'],
          },
          paint: { 'text-color': '#ffffff' },
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
          },
        });
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
        report();
        m.on('click', 'clusters', (e: MapMouseEvent) => {
          const f = m.queryRenderedFeatures(e.point, {
            layers: ['clusters'],
          })[0];
          if (!f) return;
          void (m.getSource('jobs') as GeoJSONSource)
            .getClusterExpansionZoom(f.properties.cluster_id)
            .then((zoom) =>
              m.easeTo({
                center: (
                  f.geometry as unknown as { coordinates: [number, number] }
                ).coordinates,
                zoom,
              }),
            );
        });
        m.on('click', 'points', (e: MapMouseEvent) => {
          const f = m.queryRenderedFeatures(e.point, { layers: ['points'] })[0];
          if (f) setActive(String(f.properties.job));
        });
        m.on('click', (e: MapMouseEvent) => {
          if (
            !m.queryRenderedFeatures(e.point, {
              layers: ['points', 'clusters'],
            }).length
          )
            setActive(null);
        });
        for (const id of ['points', 'clusters']) {
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
  }, []);

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
    const lit = hovered ?? active;
    m.removeFeatureState({ source: 'jobs' });
    if (!lit) return;
    for (const f of features(filtered).features)
      if (f.properties.job === lit)
        m.setFeatureState({ source: 'jobs', id: f.id }, { on: true });
  }, [ready, hovered, active, filtered]);

  const focus = (v: MapVacancy) => {
    setActive(v.id);
    setSheet(false);
    const [lat, lon] = v.places[0];
    map.current?.easeTo({
      center: [lon, lat],
      zoom: Math.max(map.current.getZoom(), 15),
    });
  };

  const total = filtered.length;
  return (
    <div className="job-map">
      <div className="job-map-bar">
        <div className="job-map-title">
          <h1>ვაკანსიები რუკაზე</h1>
          <p>
            {all
              ? `${whole.format(total)} ვაკანსია ზუსტი მისამართით`
              : 'იტვირთება…'}
          </p>
        </div>
        <label className="job-map-search">
          <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder="პოზიცია ან კომპანია"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <fieldset className="job-map-chips" aria-label="ფილტრები">
          <button
            type="button"
            aria-pressed={paid}
            onClick={() => setPaid((v) => !v)}
          >
            <Banknote size={15} strokeWidth={1.75} aria-hidden="true" />
            ხელფასით
          </button>
          <Choice
            label="ყველა მიმართულება"
            value={category || 'ყველა'}
            onChange={(v) => setCategory(v === 'ყველა' ? '' : v)}
            options={categories.map(([name]) => name)}
          />
          {cities.map(([name, center, zoom]) => (
            <button
              key={name}
              type="button"
              onClick={() => map.current?.easeTo({ center, zoom })}
            >
              <MapPin size={14} strokeWidth={1.75} aria-hidden="true" />
              {name}
            </button>
          ))}
        </fieldset>
      </div>

      <div className="job-map-body">
        <aside className="job-map-list" data-open={sheet}>
          <button
            type="button"
            className="job-map-handle"
            aria-expanded={sheet}
            onClick={() => setSheet((v) => !v)}
          >
            <span aria-hidden="true" />
            <b>{whole.format(visible.length)} ვაკანსია ამ ტერიტორიაზე</b>
            {sheet ? (
              <X size={16} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <ChevronUp size={16} strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
          <p className="job-map-hint">
            <MapPin size={14} strokeWidth={1.75} aria-hidden="true" />
            რუკაზე მხოლოდ ის ვაკანსიებია, რომელთა მისამართიც ზუსტად, შენობამდე
            დადგინდა.
          </p>
          {error && <p role="alert">{error}</p>}
          {all && !visible.length && (
            <p className="job-map-empty">
              ამ ტერიტორიაზე ვაკანსია არ ჩანს. გაადიდე ან გადაიტანე რუკა.
            </p>
          )}
          <ul>
            {visible.slice(0, listLimit).map((v) => (
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
                    {v.premium && <em>პრემიუმი</em>}
                    <strong>{v.title}</strong>
                    <span>{v.company}</span>
                    {v.salary && (
                      <b>{compactSalary(v.salary, v.salaryPeriod)}</b>
                    )}
                    <small>
                      <MapPin size={12} strokeWidth={1.75} aria-hidden="true" />
                      {v.places.map((p) => p[2]).join(' · ')}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {visible.length > listLimit && (
            <p className="job-map-more">
              და კიდევ {whole.format(visible.length - listLimit)} — გაადიდე
              რუკა, რომ სია შემცირდეს.
            </p>
          )}
        </aside>

        <div className="job-map-canvas">
          <div ref={box} className="job-map-gl" />
          {selected && (
            <article className="job-map-pop">
              <button
                type="button"
                className="job-map-pop-close"
                aria-label="დახურვა"
                onClick={() => setActive(null)}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
              <div className="job-map-pop-head">
                <CompanyLogo
                  company={selected.company}
                  url={selected.logoUrl}
                />
                <div>
                  <strong>{selected.title}</strong>
                  <span>{selected.company}</span>
                </div>
              </div>
              {selected.salary && (
                <b className="job-map-pop-salary">
                  {compactSalary(selected.salary, selected.salaryPeriod)}
                </b>
              )}
              <p>
                <MapPin size={13} strokeWidth={1.75} aria-hidden="true" />
                {selected.places.map((p) => p[2]).join(' · ')}
              </p>
              <a className="primary" href={href(selected)}>
                ვაკანსიის ნახვა
              </a>
            </article>
          )}
          <button
            type="button"
            className="job-map-listbtn"
            onClick={() => setSheet(true)}
          >
            <List size={16} strokeWidth={1.75} aria-hidden="true" />
            სია
          </button>
        </div>
      </div>
    </div>
  );
}
