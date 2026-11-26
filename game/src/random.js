// random.js — deterministic randomness for Sky Courier: a small seeded generator and a
// coordinate hash. Design intent: the world must be the same on every visit and in every
// screenshot, so terrain features are placed by hashing their coordinates (never by drawing
// from a stream whose history matters), and the one stream generator is seeded per game.

/** A mulberry32 generator: tiny, fast and good enough for jitter, particles and clouds. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A stable hash of two integer coordinates to [0, 1): the same cell always hashes the same,
 * which is what lets fields, trees and houses be placed by position alone.
 */
export function hash2(x, z) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A stable hash of three integers, for placing several features inside one cell. */
export function hash3(x, z, k) {
  return hash2(Math.imul(x | 0, 31) + (k | 0) * 1013, Math.imul(z | 0, 17) - (k | 0) * 7717);
}

/** Clamp a value into [lo, hi]. */
export function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

/** Linear interpolation, for colour mixes and camera easing. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Mix two [r, g, b] colours and return a CSS rgb() string, t from the first to the second. */
export function mixCss(c1, c2, t) {
  const r = Math.round(lerp(c1[0], c2[0], t));
  const g = Math.round(lerp(c1[1], c2[1], t));
  const b = Math.round(lerp(c1[2], c2[2], t));
  return `rgb(${r},${g},${b})`;
}

/** The shortest signed turn from one heading to another, in radians. */
export function headingDelta(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
