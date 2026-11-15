// The rules of the garden, kept free of React so they are easy to read and test.

export const NOTE_COUNT = 10;
export const MAX_SEEDS = 14;

/** How fast a ripple spreads, in points per second. */
export const RIPPLE_SPEED = 95;
/** How far a ripple from a seed's own pulse travels before it fades. */
export const RIPPLE_REACH = 280;
/** Echo ripples, from a seed that was reached by another, are smaller. */
export const ECHO_REACH = 120;

/** A touch this close to the middle of a plant is a touch on that plant. */
export const TOUCH_RADIUS = 32;
/** A tap this close to a plant rings it, so nothing is ever planted on top of another. */
export const RING_RADIUS = 44;
/** Scattered seeds keep this far from every plant and from each other. */
export const SCATTER_SPACING = 60;

/** Open paper kept at the sides of the planting bed. */
export const BED_SIDE = 28;
/** Open paper between the bed and the header above it or the controls below it: room for a plant's own leaves. */
export const BED_GAP = 34;
/** A touch this far outside the bed still counts, and lands on its edge. */
export const BED_SLACK = 20;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * The planting bed: the open ground between the bottom of the header and the
 * top of the controls. Plants grow only here, so none sits under text or a button.
 */
export function bedBetween(width, headerBottom, controlsTop) {
  return {
    left: BED_SIDE,
    right: width - BED_SIDE,
    top: headerBottom + BED_GAP,
    bottom: controlsTop - BED_GAP,
  };
}

/**
 * Where a touch lands in the bed: where it is when inside, on the nearest edge
 * when it is only just outside, and nowhere (null) when it is further out.
 */
export function placeInBed(point, bed, slack = BED_SLACK) {
  const x = clamp(point.x, bed.left, bed.right);
  const y = clamp(point.y, bed.top, bed.bottom);
  if (Math.abs(x - point.x) > slack || Math.abs(y - point.y) > slack) return null;
  return { x, y };
}

/** One of three bands of the bed, counted from the bottom: 0 is low notes, 1 middle, 2 high. */
export function bandOfBed(bed, band) {
  const third = (bed.bottom - bed.top) / 3;
  return { ...bed, top: bed.bottom - (band + 1) * third, bottom: bed.bottom - band * third };
}

/** Higher in the bed is a higher note. The ten notes share its height equally. */
export function noteForY(y, bed) {
  const fraction = 1 - clamp((y - bed.top) / Math.max(1, bed.bottom - bed.top), 0, 1);
  return Math.min(NOTE_COUNT - 1, Math.floor(fraction * NOTE_COUNT));
}

/** Each seed pulses by itself every few seconds. Further right in the bed is slower. */
export function periodForX(x, bed) {
  const fraction = clamp((x - bed.left) / Math.max(1, bed.right - bed.left), 0, 1);
  return Math.round(3600 + fraction * 5200);
}

/**
 * The tint each note's plant is painted in. Low notes are leafy and green; going
 * up the scale the greens pale, then open into blush, white and butter blossoms.
 */
export const NOTE_COLORS = [
  '#3A8C5A', // moss
  '#55A26E', // fern
  '#74B985', // leaf
  '#9ACE9F', // sage
  '#BFE0B9', // pale sage
  '#E8A996', // bud
  '#EFBBA9', // blush
  '#F8DED3', // pale blush
  '#FFFFFF', // white
  '#F4E2A8', // butter
];

export function colorForNote(note) {
  return NOTE_COLORS[clamp(note, 0, NOTE_COUNT - 1)];
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

/** The seed nearest a touch point, if one is within `radius` of it. */
export function seedAt(point, seeds, radius = TOUCH_RADIUS) {
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

/**
 * Places for up to `count` new seeds inside `area`, spread out from each other
 * and from everything in `taken` (the seeds already planted and any places
 * still waiting to be planted). Each place is the roomiest of a few random
 * tries, and a place closer than `spacing` to anything else is refused, so a
 * crowded bed gets fewer places than were asked for. They come back lowest
 * note first so they plant as a rising run.
 */
export function scatter(count, taken, area, random = Math.random, spacing = SCATTER_SPACING) {
  const places = [];
  for (let i = 0; i < count; i++) {
    const others = [...taken, ...places];
    let best = null;
    let bestGap = -1;
    for (let attempt = 0; attempt < 24; attempt++) {
      const point = {
        x: area.left + random() * (area.right - area.left),
        y: area.top + random() * (area.bottom - area.top),
      };
      const gap = Math.min(Infinity, ...others.map((other) => distance(point, other)));
      if (gap > bestGap) {
        best = point;
        bestGap = gap;
      }
    }
    if (best && bestGap >= spacing) places.push(best);
  }
  return places.sort((a, b) => b.y - a.y);
}

/** Seeds in the order they wake after a rest: lowest note first, like a scale played upwards. */
export function wakingOrder(seeds) {
  return [...seeds].sort((a, b) => b.y - a.y);
}
