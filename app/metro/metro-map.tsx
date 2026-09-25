'use client';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import type {
  GeoJSONSource,
  Map as MapLibre,
  MapMouseEvent,
} from 'maplibre-gl';
import { circleRing, walkReachMeters } from '@/lib/geo';
import type { MetroStation } from '@/lib/tbilisi-metro';
import type { MetroVacancy } from '@/lib/server/metro-jobs';

/* The same free tiles and Georgian labels as /map; this map only ever shows one station. */
const styleUrl = 'https://tiles.openfreemap.org/styles/positron';

const pins = (list: MetroVacancy[]) => ({
  type: 'FeatureCollection' as const,
  features: list.map((v, i) => ({
    type: 'Feature' as const,
    id: i,
    geometry: {
      type: 'Point' as const,
      coordinates: [v.place[1], v.place[0]],
    },
    properties: { job: v.id, premium: v.premium ? 1 : 0 },
  })),
});
const ring = (s: MetroStation, walk: number) => ({
  type: 'Feature' as const,
  properties: {},
  geometry: {
    type: 'Polygon' as const,
    coordinates: [circleRing(s.lat, s.lon, walkReachMeters(walk))],
  },
});
const bounds = (s: MetroStation, walk: number) => {
  const r = circleRing(s.lat, s.lon, walkReachMeters(walk), 4);
  return [
    [r[2][0], r[3][1]],
    [r[0][0], r[1][1]],
  ] as [[number, number], [number, number]];
};

/** Colours come from the design tokens, so the map follows the page and its theme. */
function token(el: HTMLElement, name: string, fallback: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

export function MetroMap({
  station,
  vacancies,
  walk,
  lit,
  onPick,
}: {
  station: MetroStation;
  vacancies: MetroVacancy[];
  walk: number;
  lit: string | null;
  onPick: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const pick = useRef(onPick);
  // The walk at creation only frames the first view; later changes are pushed below.
  const firstWalk = useRef(walk);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  // Created once per station (the page remounts on a new station).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let cancelled = false;
    void import('maplibre-gl').then((maplibre) => {
      if (cancelled || !box.current) return;
      maplibre.setWorkerUrl(
        `/vendor/maplibre/${maplibre.getVersion()}/maplibre-gl-worker.mjs`,
      );
      const m = new maplibre.Map({
        container: el,
        style: styleUrl,
        bounds: bounds(station, firstWalk.current),
        fitBoundsOptions: { padding: 24 },
        minZoom: 11,
        maxBounds: [
          [44.55, 41.6],
          [45.05, 41.85],
        ],
        attributionControl: { compact: true },
        // On a phone the map sits inside a scrolling page: one finger scrolls the page, two
        // move the map.
        cooperativeGestures: matchMedia('(pointer: coarse)').matches,
        locale: {
          'CooperativeGesturesHandler.MobileHelpText':
            'რუკის გადასაადგილებლად გამოიყენე ორი თითი',
          'CooperativeGesturesHandler.WindowsHelpText':
            'გასადიდებლად დააჭირე Ctrl-ს და ატრიალე',
          'CooperativeGesturesHandler.MacHelpText':
            'გასადიდებლად დააჭირე ⌘-ს და ატრიალე',
          'NavigationControl.ZoomIn': 'გადიდება',
          'NavigationControl.ZoomOut': 'დაპატარავება',
        },
      });
      map.current = m;
      m.addControl(
        new maplibre.NavigationControl({ showCompass: false }),
        'bottom-right',
      );
      const accent = token(el, '--ds-accent', '#2457e6');
      const accentInk = token(el, '--ds-accent-ink', '#1f3f96');
      const warning = token(el, '--metro-premium', '#f2b705');
      const line = token(el, `--metro-line-${station.line}`, '#d52b1e');
      const surface = token(el, '--ds-surface', '#ffffff');
      m.on('load', () => {
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
        m.addSource('reach', {
          type: 'geojson',
          data: ring(station, firstWalk.current),
        });
        m.addLayer({
          id: 'reach-fill',
          type: 'fill',
          source: 'reach',
          paint: { 'fill-color': accent, 'fill-opacity': 0.08 },
        });
        m.addLayer({
          id: 'reach-line',
          type: 'line',
          source: 'reach',
          paint: {
            'line-color': accent,
            'line-width': 1.5,
            'line-dasharray': [2, 2],
          },
        });
        m.addSource('jobs', { type: 'geojson', data: pins([]) });
        m.addLayer({
          id: 'points',
          type: 'circle',
          source: 'jobs',
          paint: {
            'circle-color': [
              'case',
              ['boolean', ['feature-state', 'on'], false],
              accentInk,
              ['==', ['get', 'premium'], 1],
              warning,
              accent,
            ],
            'circle-radius': [
              'case',
              ['boolean', ['feature-state', 'on'], false],
              10,
              6.5,
            ],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': surface,
          },
        });
        m.addSource('station', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: { name: station.name },
            geometry: {
              type: 'Point',
              coordinates: [station.lon, station.lat],
            },
          },
        });
        m.addLayer({
          id: 'station',
          type: 'circle',
          source: 'station',
          paint: {
            'circle-color': line,
            'circle-radius': 9,
            'circle-stroke-width': 4,
            'circle-stroke-color': surface,
          },
        });
        m.addLayer({
          id: 'station-name',
          type: 'symbol',
          source: 'station',
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Bold'],
            'text-size': 13,
            'text-offset': [0, 1.4],
            'text-anchor': 'top',
          },
          paint: {
            'text-color': line,
            'text-halo-color': surface,
            'text-halo-width': 2,
          },
        });
        // Keep the canvas matched to its box as the layout settles.
        const fit = new ResizeObserver(() => m.resize());
        fit.observe(el);
        m.once('remove', () => fit.disconnect());
        m.on('click', 'points', (e: MapMouseEvent) => {
          const f = m.queryRenderedFeatures(e.point, { layers: ['points'] })[0];
          if (f) pick.current(String(f.properties.job));
        });
        m.on('mouseenter', 'points', () => {
          m.getCanvas().style.cursor = 'pointer';
        });
        m.on('mouseleave', 'points', () => {
          m.getCanvas().style.cursor = '';
        });
        // Compact attribution opens itself on a narrow map; start it folded so it covers no pins.
        el.querySelector('.maplibregl-ctrl-attrib')?.classList.remove(
          'maplibregl-compact-show',
        );
        setReady(true);
      });
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [station]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    void (m.getSource('jobs') as GeoJSONSource | undefined)?.setData(
      pins(vacancies),
    );
  }, [ready, vacancies]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    void (m.getSource('reach') as GeoJSONSource | undefined)?.setData(
      ring(station, walk),
    );
    m.fitBounds(bounds(station, walk), { padding: 24, duration: 400 });
  }, [ready, station, walk]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.removeFeatureState({ source: 'jobs' });
    const i = lit ? vacancies.findIndex((v) => v.id === lit) : -1;
    if (i >= 0) m.setFeatureState({ source: 'jobs', id: i }, { on: true });
  }, [ready, lit, vacancies]);

  return <div ref={box} className="metro-map-gl" />;
}
