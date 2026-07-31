// A tiny transient popup that fades from fully opaque to invisible — used for the "+$X"
// gold text shown when a customer pays.

const LIFETIME = 1000; // ms

export class FloatingText {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.age = 0;
  }

  // returns true while still alive — call once per frame, drop it from the list once false
  update(dt) {
    this.age += dt;
    return this.age < LIFETIME;
  }

  get opacity() {
    return Math.max(0, 1 - this.age / LIFETIME);
  }
}
