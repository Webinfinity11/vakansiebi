/** A trackpad gesture includes its momentum. Only a new gesture may change another card. */
export const wheelIdleMs = 240;
export class SwipeWheelGesture {
  private lastAt = -Infinity;
  private axis: 'x' | 'y' | null = null;
  private consumed = false;
  private x = 0;

  stop(now: number) {
    this.lastAt = now;
    this.consumed = true;
    this.x = 0;
  }

  move(deltaX: number, deltaY: number, now: number, threshold: number) {
    if (now - this.lastAt > wheelIdleMs) {
      this.axis = null;
      this.consumed = false;
      this.x = 0;
    }
    this.lastAt = now;
    if (this.consumed) return { prevent: true, x: 0 };
    if (!this.axis) {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 3)
        return { prevent: false, x: 0 };
      this.axis = Math.abs(deltaX) >= 2 * Math.abs(deltaY) ? 'x' : 'y';
    }
    if (this.axis === 'y') return { prevent: false, x: 0 };
    this.x -= deltaX;
    if (Math.abs(this.x) > threshold) {
      const side = this.x > 0 ? 'right' : 'left';
      this.stop(now);
      return { prevent: true, x: 0, side } as const;
    }
    return { prevent: true, x: this.x };
  }
}
