// The rules of the garden, kept free of React so they are easy to read and test.

export const NOTE_COUNT = 10;
export const MAX_SEEDS = 14;

/** How fast a ripple spreads, in points per second. */
export const RIPPLE_SPEED = 95;
/** How far a ripple from a seed's own pulse travels before it fades. */
export const RIPPLE_REACH = 280;
/** Echo ripples, from a seed that was reached by another, are smaller. */
export const ECHO_REACH = 120;

/** Higher on the screen is a higher note. */
export function noteForY(y, height) {
  const fraction = 1 - Math.min(1, Math.max(0, y / Math.max(1, height)));
  return Math.min(NOTE_COUNT - 1, Math.floor(fraction * NOTE_COUNT));
}

/** Each seed pulses by itself every few seconds. Further right is slower. */
export function periodForX(x, width) {
  const fraction = Math.min(1, Math.max(0, x / Math.max(1, width)));
  return Math.round(3600 + fraction * 5200);
}

export function colorForNote(note) {
  const hue = 160 + (note / (NOTE_COUNT - 1)) * 150;
  return `hsl(${Math.round(hue)}, 85%, 70%)`;
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * The seeds a ripple from `source` will reach, with the delay in milliseconds
 * until it gets to each one.
 */
export function reached(source, seeds) {
  const hits = [];
  for (const seed of seeds) {
    if (seed.id === source.id) continue;
    const d = distance(source, seed);
    if (d <= RIPPLE_REACH) {
      hits.push({ id: seed.id, delay: (d / RIPPLE_SPEED) * 1000 });
    }
  }
  return hits;
}

/** The seed under a touch point, if any. */
export function seedAt(point, seeds, radius = 26) {
  let best = null;
  let bestDistance = radius;
  for (const seed of seeds) {
    const d = distance(point, seed);
    if (d <= bestDistance) {
      best = seed;
      bestDistance = d;
    }
  }
  return best;
}
