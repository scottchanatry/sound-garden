// Quick checks of the garden's rules. Run with: node scripts/test-garden.mjs
import assert from 'node:assert/strict';
import {
  BED_GAP,
  BED_SIDE,
  BED_SLACK,
  NOTE_COLORS,
  NOTE_COUNT,
  RING_RADIUS,
  RIPPLE_REACH,
  RIPPLE_SPEED,
  SCATTER_SPACING,
  TOUCH_RADIUS,
  bandOfBed,
  bedBetween,
  colorForNote,
  noteForY,
  periodForX,
  placeInBed,
  reached,
  scatter,
  seedAt,
  wakingOrder,
} from '../src/garden.js';

// A repeatable stand-in for Math.random.
let state = 7;
const random = () => (state = (state * 16807) % 2147483647) / 2147483647;

// The bed on a 390 x 844 phone: header ends at 120, controls start at 744.
const bed = bedBetween(390, 120, 744);
assert.deepEqual(bed, { left: BED_SIDE, right: 390 - BED_SIDE, top: 120 + BED_GAP, bottom: 744 - BED_GAP });

assert.deepEqual(placeInBed({ x: 200, y: 400 }, bed), { x: 200, y: 400 }, 'a touch in the bed lands where it is');
assert.deepEqual(placeInBed({ x: 200, y: bed.top - BED_SLACK }, bed), { x: 200, y: bed.top }, 'a touch just above the bed lands on its top edge');
assert.deepEqual(placeInBed({ x: bed.right + 5, y: bed.bottom + 5 }, bed), { x: bed.right, y: bed.bottom }, 'a touch just past a corner lands on the corner');
assert.equal(placeInBed({ x: 200, y: bed.top - BED_SLACK - 1 }, bed), null, 'a touch on the header does nothing');
assert.equal(placeInBed({ x: 200, y: 800 }, bed), null, 'a touch among the controls does nothing');
assert.equal(placeInBed({ x: 2, y: 400 }, bed), null, 'a touch at the very edge of the screen does nothing');

assert.equal(noteForY(bed.top, bed), NOTE_COUNT - 1, 'top of the bed is the highest note');
assert.equal(noteForY(bed.bottom, bed), 0, 'bottom of the bed is the lowest note');
assert.equal(noteForY(0, bed), NOTE_COUNT - 1);
assert.equal(noteForY(844, bed), 0);
assert.equal(noteForY(400, { left: 0, right: 0, top: 0, bottom: 0 }), 0, 'no layout yet does not crash');

// Every note has its own strip of open ground, all the same height.
const strip = (bed.bottom - bed.top) / NOTE_COUNT;
for (let note = 0; note < NOTE_COUNT; note++) {
  assert.equal(noteForY(bed.bottom - (note + 0.5) * strip, bed), note, `note ${note} can be planted in the bed`);
}

assert.equal(periodForX(bed.left, bed), 3600, 'the left edge of the bed is the quickest beat');
assert.equal(periodForX(bed.right, bed), 8800, 'the right edge of the bed is the slowest beat');
assert.ok(periodForX(100, bed) < periodForX(300, bed), 'further right is slower');
assert.equal(periodForX(0, bed), 3600);

const low = bandOfBed(bed, 0);
const high = bandOfBed(bed, 2);
assert.equal(low.bottom, bed.bottom);
assert.equal(high.top, bed.top);
assert.ok(noteForY((low.top + low.bottom) / 2, bed) < noteForY((high.top + high.bottom) / 2, bed), 'the low band holds lower notes than the high band');

const a = { id: 1, x: 100, y: 300 };
const near = { id: 2, x: 100 + RIPPLE_SPEED, y: 300 };
const far = { id: 3, x: 100 + RIPPLE_REACH + 1, y: 300 };
const hits = reached(a, [a, near, far]);
assert.deepEqual(hits.map((hit) => hit.id), [2], 'only seeds within reach are hit, and never the source');
assert.ok(Math.abs(hits[0].delay - 1000) < 1e-6, 'a seed one second away is reached after one second');

assert.equal(seedAt({ x: 104, y: 303 }, [a, near]).id, 1);
assert.equal(seedAt({ x: 300, y: 500 }, [a, near]), null);
assert.equal(TOUCH_RADIUS, 32, 'a plant is touched anywhere on its drawing');
assert.equal(seedAt({ x: 100 + TOUCH_RADIUS, y: 300 }, [a]).id, 1, 'a touch on a leaf tip is a touch on the plant');
assert.equal(seedAt({ x: 100 + TOUCH_RADIUS + 1, y: 300 }, [a]), null);
assert.equal(seedAt({ x: 100, y: 300 + RING_RADIUS }, [a], RING_RADIUS).id, 1, 'a tap just beside a plant finds that plant, so it is rung');
assert.equal(seedAt({ x: 100, y: 300 + RING_RADIUS + 1 }, [a], RING_RADIUS), null, 'a tap further off is open ground');
assert.equal(seedAt({ x: 60, y: 300 }, [a, { id: 4, x: 30, y: 300 }], RING_RADIUS).id, 4, 'the nearest of two plants is the one found');

assert.equal(NOTE_COLORS.length, NOTE_COUNT, 'every note has its own colour');
assert.equal(new Set(NOTE_COLORS).size, NOTE_COUNT, 'no two notes share a colour');
assert.equal(colorForNote(0), NOTE_COLORS[0]);
assert.equal(colorForNote(NOTE_COUNT - 1), NOTE_COLORS[NOTE_COUNT - 1]);

const gapsOf = (points) => points.flatMap((point, i) => points.slice(i + 1).map((other) => Math.hypot(point.x - other.x, point.y - other.y)));

const places = scatter(6, [a], bed, random);
assert.equal(places.length, 6, 'scatter gives as many places as asked for when there is room');
for (const place of places) {
  assert.ok(place.x >= bed.left && place.x <= bed.right && place.y >= bed.top && place.y <= bed.bottom, 'places stay inside the bed');
}
for (let i = 1; i < places.length; i++) {
  assert.ok(places[i].y <= places[i - 1].y, 'places come lowest note first');
}
assert.ok(Math.min(...gapsOf([a, ...places])) >= SCATTER_SPACING, 'scattered places keep clear of each other and of the plants');
assert.deepEqual(scatter(0, [], bed, random), []);

// Scatter after scatter, as when the button is pressed again and again: never two plants touching.
const seen = new Set();
for (let run = 0; run < 400; run++) {
  const first = scatter(6, [], bed, random);
  const second = scatter(6, first, bed, random);
  const third = scatter(2, [...first, ...second], bed, random);
  const all = [...first, ...second, ...third];
  assert.ok(Math.min(...gapsOf(all)) >= SCATTER_SPACING, 'no two scattered plants are closer than the spacing');
  for (const place of all) seen.add(noteForY(place.y, bed));
}
assert.equal(seen.size, NOTE_COUNT, 'scatter can produce every note');

// Places still waiting to be planted count as taken.
const pending = [{ x: 200, y: 400 }];
for (const place of scatter(6, pending, bed, random)) {
  assert.ok(Math.hypot(place.x - 200, place.y - 400) >= SCATTER_SPACING, 'a new place keeps clear of a pending one');
}

// A bed with no room left refuses instead of crowding.
const tiny = { left: 100, right: 130, top: 300, bottom: 330 };
assert.deepEqual(scatter(3, [{ x: 115, y: 315 }], tiny, random), [], 'no place is offered next to a plant');
assert.equal(scatter(3, [], tiny, random).length, 1, 'a small bed takes one seed and refuses the rest');

assert.deepEqual(
  wakingOrder([{ id: 1, y: 200 }, { id: 2, y: 600 }, { id: 3, y: 400 }]).map((seed) => seed.id),
  [2, 3, 1],
  'plants wake lowest note first'
);

console.log('garden rules: all checks passed');
