import test from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutMarkers,
  metroLabel,
  segmentDistance,
} from '../lib/map-marker-layout';

const viewport = { width: 390, height: 600 };

void test('a badge on the metro moves clear of its line and station label without changing the input anchor', () => {
  const anchor = { id: 'station-jobs', x: 195, y: 280, radius: 21 };
  const line = { from: { x: 195, y: 50 }, to: { x: 195, y: 550 } };
  const label = { left: 125, right: 265, top: 292, bottom: 330 };
  const placed = layoutMarkers([anchor], [line], [label], viewport).get(
    anchor.id,
  )!;
  assert.ok(segmentDistance(placed, line) >= anchor.radius + 9);
  assert.ok(
    placed.x + placed.radius < label.left ||
      placed.x - placed.radius > label.right ||
      placed.y + placed.radius < label.top ||
      placed.y - placed.radius > label.bottom,
  );
  assert.deepEqual(anchor, { id: 'station-jobs', x: 195, y: 280, radius: 21 });
});

void test('clear badges stay at their true anchors; nearby badges do not stack and stay in the viewport', () => {
  const markers = [
    { id: 'clear', x: 90, y: 90, radius: 14 },
    { id: 'a', x: 195, y: 280, radius: 17 },
    { id: 'b', x: 195, y: 280, radius: 14 },
  ];
  const result = layoutMarkers(markers, [], [], viewport);
  assert.deepEqual(result.get('clear'), markers[0]);
  const a = result.get('a')!,
    b = result.get('b')!;
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius + 8);
  for (const point of result.values()) {
    assert.ok(
      point.x >= point.radius && point.x <= viewport.width - point.radius,
    );
    assert.ok(
      point.y >= point.radius && point.y <= viewport.height - point.radius,
    );
  }
  assert.deepEqual(
    result,
    layoutMarkers([...markers].reverse(), [], [], viewport),
  );
});

void test('line clearance handles endpoints and degenerate segments; Georgian labels wrap predictably', () => {
  assert.equal(
    segmentDistance(
      { x: 3, y: 4 },
      { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } },
    ),
    5,
  );
  assert.equal(
    segmentDistance(
      { x: 13, y: 4 },
      { from: { x: 0, y: 0 }, to: { x: 10, y: 0 } },
    ),
    5,
  );
  assert.equal(
    metroLabel('სახელმწიფო უნივერსიტეტი'),
    'სახელმწიფო\nუნივერსიტეტი',
  );
  assert.equal(metroLabel('რუსთაველი'), 'რუსთაველი');
});
