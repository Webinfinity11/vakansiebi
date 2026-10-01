export type ScreenPoint = { x: number; y: number };
export type ScreenRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
export type ScreenSegment = { from: ScreenPoint; to: ScreenPoint };
export type LayoutMarker = ScreenPoint & { id: string; radius: number };

export function segmentDistance(point: ScreenPoint, segment: ScreenSegment) {
  const dx = segment.to.x - segment.from.x;
  const dy = segment.to.y - segment.from.y;
  const length = dx * dx + dy * dy;
  const t = length
    ? Math.max(
        0,
        Math.min(
          1,
          ((point.x - segment.from.x) * dx + (point.y - segment.from.y) * dy) /
            length,
        ),
      )
    : 0;
  return Math.hypot(
    point.x - segment.from.x - t * dx,
    point.y - segment.from.y - t * dy,
  );
}

function rectDistance(point: ScreenPoint, rect: ScreenRect) {
  return Math.hypot(
    Math.max(rect.left - point.x, 0, point.x - rect.right),
    Math.max(rect.top - point.y, 0, point.y - rect.bottom),
  );
}

/** Move visual badges only. Every caller retains the original geographic anchor. */
export function layoutMarkers(
  markers: LayoutMarker[],
  segments: ScreenSegment[],
  labels: ScreenRect[],
  viewport: { width: number; height: number },
) {
  const placed: LayoutMarker[] = [];
  const ordered = [...markers].sort(
    (a, b) => b.radius - a.radius || a.id.localeCompare(b.id),
  );
  const overflow = (point: ScreenPoint, radius: number) =>
    Math.max(
      radius + 4 - point.x,
      0,
      point.x + radius + 4 - viewport.width,
      radius + 4 - point.y,
      point.y + radius + 4 - viewport.height,
    );
  for (const marker of ordered) {
    const penalty = (p: ScreenPoint) => {
      let cost = overflow(p, marker.radius) * 4;
      for (const line of segments)
        cost += Math.max(marker.radius + 9 - segmentDistance(p, line), 0);
      for (const rect of labels)
        cost += Math.max(marker.radius + 6 - rectDistance(p, rect), 0);
      for (const other of placed)
        cost += Math.max(
          marker.radius +
            other.radius +
            8 -
            Math.hypot(p.x - other.x, p.y - other.y),
          0,
        );
      return cost;
    };
    let best: ScreenPoint = marker;
    let bestCost = penalty(marker);
    if (bestCost > 0) {
      search: for (let distance = 12; distance <= 180; distance += 8) {
        for (let angle = 0; angle < 24; angle++) {
          const radians = (angle * Math.PI) / 12;
          const point = {
            x: marker.x + Math.cos(radians) * distance,
            y: marker.y + Math.sin(radians) * distance,
          };
          const cost = penalty(point);
          if (cost < bestCost) [best, bestCost] = [point, cost];
          if (cost === 0) break search;
        }
      }
    }
    placed.push({ ...marker, x: best.x, y: best.y });
  }
  return new Map(placed.map((p) => [p.id, p]));
}

/** Explicit two-line names keep the label geometry predictable for badge avoidance. */
export function metroLabel(name: string) {
  const lines: string[] = [];
  for (const word of name.split(' ')) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + word.length + 1 <= 18)
      lines[last] += ` ${word}`;
    else lines.push(word);
  }
  return lines.join('\n');
}
