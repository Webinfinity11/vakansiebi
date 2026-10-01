import type { Map as MapLibre, GeoJSONSource } from 'maplibre-gl';
import type { Feature, Point, LineString } from 'geojson';
import {
  layoutMarkers,
  metroLabel,
  type ScreenRect,
  type ScreenSegment,
} from '@/lib/map-marker-layout';
import { metroNetwork } from '@/lib/map-metro';
import { metroStations } from '@/lib/tbilisi-metro';

const empty = { type: 'FeatureCollection' as const, features: [] };

export function addClusterLayoutSources(map: MapLibre) {
  map.addSource('job-cluster-display', { type: 'geojson', data: empty });
  map.addSource('job-cluster-links', { type: 'geojson', data: empty });
  // The native clustered source stays untouched for counts, leaves and expansion zooms.
  map.addLayer({
    id: 'cluster-anchors',
    type: 'circle',
    source: 'jobs',
    filter: ['has', 'point_count'],
    paint: { 'circle-radius': 1, 'circle-opacity': 0 },
  });
  map.addLayer({
    id: 'cluster-links',
    type: 'line',
    source: 'job-cluster-links',
    paint: { 'line-color': '#7892bb', 'line-width': 1, 'line-opacity': 0.45 },
  });
}

export function installClusterLayout(map: MapLibre) {
  let frame = 0;
  let previous = '';
  const sync = () => {
    frame = 0;
    if (map.isMoving() || !map.isSourceLoaded('jobs')) return;
    const canvas = map.getCanvas();
    const viewport = { width: canvas.clientWidth, height: canvas.clientHeight };
    const clusters = new Map(
      map
        .queryRenderedFeatures({ layers: ['cluster-anchors'] })
        .filter((f) => f.geometry.type === 'Point')
        .map((f) => [String(f.properties.cluster_id), f]),
    );
    const segments: ScreenSegment[] =
      map.getZoom() < 10
        ? []
        : metroNetwork.features.flatMap((line) =>
            line.geometry.coordinates.slice(1).map((to, i) => ({
              from: map.project(
                line.geometry.coordinates[i] as [number, number],
              ),
              to: map.project(to as [number, number]),
            })),
          );
    const visibleNames = new Set(
      map
        .queryRenderedFeatures({ layers: ['metro-names'] })
        .map((f) => String(f.properties.slug)),
    );
    const labels: ScreenRect[] = [];
    if (map.getZoom() >= 10)
      for (const station of metroStations) {
        const p = map.project([station.lon, station.lat]);
        // Also protect the station circles and their touch padding, including line endpoints.
        labels.push({
          left: p.x - 12,
          right: p.x + 12,
          top: p.y - 12,
          bottom: p.y + 12,
        });
        if (!visibleNames.has(station.slug)) continue;
        const lines = metroLabel(station.name).split('\n');
        const width = Math.max(...lines.map((s) => s.length)) * 7.2;
        labels.push({
          left: p.x - width / 2 - 3,
          right: p.x + width / 2 + 3,
          top: p.y + 10,
          bottom: p.y + 14 + lines.length * 15,
        });
      }
    const markers = [...clusters].map(([id, f]) => {
      const point = map.project(
        (f.geometry as Point).coordinates as [number, number],
      );
      return {
        id,
        x: point.x,
        y: point.y,
        radius:
          f.properties.point_count >= 50
            ? 21
            : f.properties.point_count >= 10
              ? 17
              : 14,
      };
    });
    const layout = layoutMarkers(markers, segments, labels, viewport);
    const badges: Feature<Point>[] = [];
    const links: Feature<LineString>[] = [];
    for (const [id, f] of clusters) {
      const anchor = (f.geometry as Point).coordinates;
      const position = layout.get(id)!;
      const geographic = map.unproject([position.x, position.y]);
      const target = [geographic.lng, geographic.lat];
      badges.push({
        type: 'Feature',
        id: Number(id),
        properties: {
          ...f.properties,
          anchorLon: anchor[0],
          anchorLat: anchor[1],
        },
        geometry: { type: 'Point', coordinates: target },
      });
      const origin = map.project(anchor as [number, number]);
      if (Math.hypot(origin.x - position.x, origin.y - position.y) > 2) {
        // Stop at the badge's edge; a line never shows through its white centre.
        const distance = Math.hypot(
          origin.x - position.x,
          origin.y - position.y,
        );
        const edge = map.unproject([
          position.x + ((origin.x - position.x) * position.radius) / distance,
          position.y + ((origin.y - position.y) * position.radius) / distance,
        ]);
        links.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [anchor, [edge.lng, edge.lat]],
          },
        });
      }
    }
    const key = JSON.stringify(badges);
    if (key === previous) return;
    previous = key;
    void (map.getSource('job-cluster-display') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: badges,
    });
    void (map.getSource('job-cluster-links') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: links,
    });
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(sync);
  };
  map.on('moveend', schedule);
  map.on('idle', schedule);
  map.on('sourcedata', (event) => {
    if (event.sourceId === 'jobs' && event.isSourceLoaded) schedule();
  });
  map.once('remove', () => cancelAnimationFrame(frame));
  schedule();
}
