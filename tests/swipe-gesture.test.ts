import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SwipeWheelGesture } from '../lib/swipe-gesture';

void test('a long wheel gesture advances only once, including momentum after the next card appears', () => {
  const gesture = new SwipeWheelGesture();
  const sides = Array.from(
    { length: 30 },
    (_, i) => gesture.move(45, 0, i * 65, 110).side,
  ).filter(Boolean);
  assert.deepEqual(sides, ['left']);
  assert.equal(gesture.move(120, 0, 2300, 110).side, 'left');
});
void test('vertical reading remains vertical even when the ending momentum drifts sideways', () => {
  const gesture = new SwipeWheelGesture();
  assert.equal(gesture.move(8, 40, 0, 110).prevent, false);
  for (let i = 1; i < 20; i++)
    assert.equal(gesture.move(45, 1, i * 50, 110).prevent, false);
  assert.equal(gesture.move(-120, 0, 1300, 110).side, 'right');
});
void test('a button transition cancels a partial drag and consumes the old momentum', () => {
  const gesture = new SwipeWheelGesture();
  assert.equal(gesture.move(70, 0, 0, 110).x, -70);
  gesture.stop(100);
  assert.equal(gesture.move(90, 0, 200, 110).side, undefined);
  assert.equal(gesture.move(50, 0, 500, 110).x, -50);
  assert.equal(gesture.move(70, 0, 550, 110).side, 'left');
});
