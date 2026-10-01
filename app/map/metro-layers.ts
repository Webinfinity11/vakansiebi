import type { Map as MapLibre, GeoJSONSource, PointLike } from 'maplibre-gl';
import { circleRing, walkReachMeters } from '@/lib/geo';
import { metroColors, metroNetwork } from '@/lib/map-metro';
import { metroStations, type MetroStation } from '@/lib/tbilisi-metro';
import { metroLabel } from '@/lib/map-marker-layout';

const empty = { type: 'FeatureCollection' as const, features: [] };
export const stationHitLayers = ['metro-stations-hit', 'metro-names'];

/** Visible circles decide overlapping taps; a station's generous hit area must not steal a job tap. */
export function stationAtPoint(map: MapLibre, point: PointLike) {
  const station = map.queryRenderedFeatures(point, {
    layers: ['metro-stations'],
  })[0];
  if (station) return station;
  if (
    map.queryRenderedFeatures(point, { layers: ['clusters', 'points'] }).length
  )
    return undefined;
  return map.queryRenderedFeatures(point, { layers: stationHitLayers })[0];
}

/** Lines under vacancies; stations above them so their controls remain clickable. */
export function addMetroLines(map: MapLibre) {
  map.addSource('metro-reach', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'metro-reach-fill',
    type: 'fill',
    source: 'metro-reach',
    paint: { 'fill-color': '#2457e6', 'fill-opacity': 0.07 },
  });
  map.addLayer({
    id: 'metro-reach-outline',
    type: 'line',
    source: 'metro-reach',
    paint: {
      'line-color': '#2457e6',
      'line-width': 1.5,
      'line-dasharray': [3, 3],
    },
  });
  map.addSource('metro-network', {
    type: 'geojson',
    data: metroNetwork,
    attribution: 'მეტროს ხაზები სქემატურია',
  });
  map.addLayer({
    id: 'metro-shadow',
    type: 'line',
    source: 'metro-network',
    minzoom: 10,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 10,
      'line-blur': 3,
      'line-opacity': 0.1,
    },
  });
  map.addLayer({
    id: 'metro-casing',
    type: 'line',
    source: 'metro-network',
    minzoom: 10,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#fff', 'line-width': 6.5, 'line-opacity': 0.96 },
  });
  map.addLayer({
    id: 'metro-lines',
    type: 'line',
    source: 'metro-network',
    minzoom: 10,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 3,
      'line-opacity': 0.9,
    },
  });
}

export function addMetroStations(
  map: MapLibre,
  onSelect: (slug: string) => void,
) {
  map.addSource('metro-stops', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: metroStations.map((s) => ({
        type: 'Feature',
        id: s.slug,
        properties: {
          slug: s.slug,
          name: s.name,
          label: metroLabel(s.name),
          color: metroColors[s.line],
        },
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      })),
    },
  });
  map.addLayer({
    id: 'metro-stations-hit',
    type: 'circle',
    source: 'metro-stops',
    minzoom: 10,
    paint: { 'circle-radius': 17, 'circle-opacity': 0 },
  });
  map.addLayer({
    id: 'metro-station-halo',
    type: 'circle',
    source: 'metro-stops',
    minzoom: 10,
    paint: {
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        20,
        9,
      ],
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.1,
    },
  });
  map.addLayer({
    id: 'metro-stations',
    type: 'circle',
    source: 'metro-stops',
    minzoom: 10,
    paint: {
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'selected'], false],
        10,
        5,
      ],
      'circle-color': '#fff',
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: 'metro-names',
    type: 'symbol',
    source: 'metro-stops',
    minzoom: 11,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-anchor': 'top',
      'text-offset': [0, 1.2],
      'text-max-width': 20,
      'text-justify': 'auto',
      'text-padding': 5,
    },
    paint: {
      'text-color': '#40516a',
      'text-halo-color': '#fff',
      'text-halo-width': 2,
    },
  });
  map.on('click', stationHitLayers, (e) => {
    const stop = stationAtPoint(map, e.point);
    if (stop) onSelect(String(stop.properties.slug));
  });
  map.on('mouseenter', stationHitLayers, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', stationHitLayers, () => {
    map.getCanvas().style.cursor = '';
  });
}

export function updateMetro(
  map: MapLibre,
  station: MetroStation | undefined,
  walk: number,
) {
  map.removeFeatureState({ source: 'metro-stops' });
  if (station)
    map.setFeatureState(
      { source: 'metro-stops', id: station.slug },
      { selected: true },
    );
  void (map.getSource('metro-reach') as GeoJSONSource).setData(
    station
      ? {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              circleRing(station.lat, station.lon, walkReachMeters(walk)),
            ],
          },
        }
      : empty,
  );
}

export function frameStation(
  map: MapLibre,
  station: MetroStation,
  walk: number,
) {
  const ring = circleRing(station.lat, station.lon, walkReachMeters(walk), 4);
  map.fitBounds(
    [
      [ring[2][0], ring[3][1]],
      [ring[0][0], ring[1][1]],
    ],
    {
      padding: {
        top: 45,
        bottom: matchMedia('(max-width: 900px)').matches ? 205 : 45,
        left: 35,
        right: 45,
      },
      maxZoom: 16,
      duration: 500,
    },
  );
}
