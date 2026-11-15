// How the garden's plants and line-art are drawn. Everything here is plain
// geometry that returns SVG path strings, worked out once when the app loads.

import { NOTE_COLORS, NOTE_COUNT } from './garden';
import { BUTTER, INK } from './theme';

/** Plants are drawn on a square this many points across, growing from its middle. */
export const PLANT_BOX = 64;
const MIDDLE = PLANT_BOX / 2;

const tidy = (value) => Math.round(value * 100) / 100;

/**
 * The lie of a shape that grows from (cx, cy) and points at `angle` degrees
 * (0 is up, turning clockwise). The result turns a distance `along` the shape
 * and `across` it into a point on the page. With a `bend` the shape curves to
 * one side, so that its tip lands `bend` times its `length` off the line.
 */
function lie(cx, cy, angle, length = 1, bend = 0) {
  const turn = (angle * Math.PI) / 180;
  const sin = Math.sin(turn);
  const cos = Math.cos(turn);
  return (along, across = 0) => {
    const aside = across + (bend * along * along) / length;
    return `${tidy(cx + along * sin + aside * cos)} ${tidy(cy - along * cos + aside * sin)}`;
  };
}

/** Curves through `points`, which come in threes: two to steer by, then where the curve arrives. */
const curves = (at, points) => points.map(([along, across], i) => (i % 3 ? ' ' : 'C') + at(along, across)).join('');

/**
 * A closed shape that is the same on both sides of its middle line. `edge` is
 * one side of it, from the stalk out to the last point, which is on the line.
 */
function mirrored(at, edge) {
  const out = edge.map(([along, across]) => [along, -across]);
  const back = [[0, 0], ...edge.slice(0, -1)].reverse();
  return `M${at(0, 0)}${curves(at, out)}${curves(at, back)}Z`;
}

// A curve bulges three quarters of the way out to the points it is steered by.
const BULGE = 4 / 3;
// How far to steer each of four curves so that together they make a circle.
const ROUND = 0.5523;

/** An almond leaf: rounded at the stalk, pointed at the tip. */
function leaf(at, length, width) {
  const reach = (width / 2) * BULGE;
  return mirrored(at, [[length * 0.3, reach], [length * 0.62, reach * 0.9], [length, 0]]);
}

/** A blade of grass: widest low down, then a long taper to its point. */
function blade(at, length, width) {
  const reach = (width / 2) * BULGE;
  return mirrored(at, [[length * 0.16, reach], [length * 0.5, reach * 0.8], [length, 0]]);
}

/** A seed leaf: a short stalk, then a broad round blade. */
function seedLeaf(at, length, width) {
  const half = width / 2;
  return mirrored(at, [
    [length * 0.1, half * 0.12], [length * 0.2, half * 0.1], [length * 0.27, half * 0.3],
    [length * 0.38, half * 0.9], [length * 0.5, half], [length * 0.64, half],
    [length * 0.86, half], [length, half * 0.6], [length, 0],
  ]);
}

/** A long leaf with saw teeth down both sides, like a dandelion's. */
function toothed(at, length, width) {
  const half = width / 2;
  const edge = [];
  let from = [0, 0];
  // Each tooth swells out to its point, then is cut straight back in.
  for (const [along, across] of [[0.34, 0.66], [0.6, 1]]) {
    const tip = [length * along, half * across];
    const nick = [length * (along + 0.06), half * across * 0.4];
    edge.push([from[0] + (tip[0] - from[0]) * 0.3, from[1] + (tip[1] - from[1]) * 0.75], [tip[0] - length * 0.08, tip[1]], tip);
    edge.push([tip[0] + (nick[0] - tip[0]) / 3, tip[1] + (nick[1] - tip[1]) / 3], [nick[0], nick[1] + (tip[1] - nick[1]) / 3], nick);
    from = nick;
  }
  edge.push([length * 0.76, half * 0.86], [length * 0.92, half * 0.56], [length, 0]);
  return mirrored(at, edge);
}

/** A petal: narrow at the heart of the flower, wide and round at the end. */
function petal(at, length, width) {
  const reach = (width / 2) * BULGE;
  return mirrored(at, [[length * 0.42, reach], [length * 1.04, reach * 0.96], [length, 0]]);
}

/** A petal or leaflet with a dip in its far edge, like a heart. `dip` is how deep it goes, as a share of the length. */
function lobed(at, length, width, dip) {
  const half = width / 2;
  return mirrored(at, [
    [length * 0.16, half * 0.3], [length * 0.4, half], [length * 0.66, half],
    [length * 0.86, half], [length, half * 0.86], [length, half * 0.5],
    [length, half * 0.22], [length * (1 - dip * 0.4), half * 0.08], [length * (1 - dip), 0],
  ]);
}

/** A wedge of a petal whose far edge is cut into three soft teeth. */
function fringed(at, length, width) {
  const half = width / 2;
  return mirrored(at, [
    [length * 0.34, half * 0.3], [length * 0.6, half], [length * 0.87, half],
    [length * 0.99, half * 0.96], [length * 0.99, half * 0.52], [length * 0.92, half * 0.36],
    [length * 0.99, half * 0.34], [length * 1.02, half * 0.14], [length * 1.02, 0],
  ]);
}

/** The rib down the middle of a leaf, or the crease in a petal, between two shares of its length. */
function rib(at, length, from = 0.2, to = 0.76) {
  return `M${at(length * from)}Q${at((length * (from + to)) / 2)} ${at(length * to)}`;
}

/** The two veins that leave the rib near the stalk of a broad leaf and swing out towards its edges. */
function veins(at, length, width) {
  const side = (half) => `M${at(length * 0.14, half * 0.12)}Q${at(length * 0.5, half * 0.8)} ${at(length * 0.8, half * 0.24)}`;
  return side(-width / 2) + side(width / 2);
}

/** A round dot of `radius`, centred `along` the line. */
function dot(at, along, radius) {
  const steer = radius * ROUND;
  const near = along - radius;
  const far = along + radius;
  return `M${at(near)}${curves(at, [
    [near, -steer], [along - steer, -radius], [along, -radius],
    [along + steer, -radius], [far, -steer], [far, 0],
    [far, steer], [along + steer, radius], [along, radius],
    [along - steer, radius], [near, steer], [near, 0],
  ])}Z`;
}

/** An almond leaf: rounded at the stalk, pointed at the tip, and curving to one side if given a `bend`. */
export function leafPath(cx, cy, angle, length, width, bend = 0) {
  return leaf(lie(cx, cy, angle, length, bend), length, width);
}

/** The rib down the middle of a leaf. */
export function ribPath(cx, cy, angle, length, bend = 0) {
  return rib(lie(cx, cy, angle, length, bend), length);
}

// No hand draws the same leaf twice. These are its small slips, between -1 and
// 1, read off in turn. They are fixed, so a plant looks the same every time.
const SLIPS = [0.3, -0.85, 0.65, -0.2, 1, -0.6, 0.1, -1, 0.8, -0.4, 0.5, -0.75, 0.9];
const slip = (n) => SLIPS[n % SLIPS.length];

/** A place for one leaf or petal: its lie, how long it is, and its `lean`: how far it curves, and to which side. */
const place = (angle, length, lean) => ({ at: lie(MIDDLE, MIDDLE, angle, length, 0.1 * lean), length, lean });

/**
 * Places for `count` shapes set evenly round the middle of a plant, starting
 * at `turn` degrees, each up to 4 degrees and 7 percent off true and curving
 * its own way. `hand` picks which slips this whorl gets.
 */
function whorl(count, turn, length, hand) {
  const places = [];
  for (let i = 0; i < count; i++) {
    const angle = turn + (i * 360) / count + 4 * slip(hand + i);
    const reach = length * (1 + 0.07 * slip(hand + 2 * i + 4));
    places.push(place(angle, reach, slip(hand + 3 * i + 7)));
  }
  return places;
}

/** Places set out one by one, as [angle, length, lean], for plants with too few leaves to leave to chance. */
const placed = (list) => list.map(([angle, length, lean]) => place(angle, length, lean));

const tint = (note) => NOTE_COLORS[note];

// The four ways a mark is put down. Each mark becomes one path in the drawing.
/** A tinted shape with an ink outline. */
const painted = (d, fill) => ({ d, fill, weight: 1, opacity: 1 });
/** A fine ink line: a rib. */
const inked = (d) => ({ d, fill: 'none', weight: 0.85, opacity: 1 });
/** A fainter line: a crease in a petal, a vein, a thread. */
const faint = (d) => ({ d, fill: 'none', weight: 0.85, opacity: 0.35 });
/** Solid ink with no outline: stamens, and the seed a plant grew from. */
const dotted = (d) => ({ d, fill: INK, weight: 0, opacity: 1 });

/** One path with the same `shape` drawn at every place. Good for lines, and for shapes that do not cross. */
const together = (places, shape) => places.map(({ at, length }) => shape(at, length)).join('');
/** A painted `shape` at every place, each a mark of its own so that it lies over the one before. */
const apart = (places, shape, fill) => places.map(({ at, length }) => painted(shape(at, length), fill));

const CENTRE = lie(MIDDLE, MIDDLE, 0);
const heart = (size, fill = BUTTER) => painted(dot(CENTRE, 0, size), fill);
const seed = (size) => dotted(dot(CENTRE, 0, size));

/** A ring of stamens: a dot of about `size` at the far end of every place. */
const stamens = (places, size) => dotted(places.map(({ at, length, lean }) => dot(at, length, size * (1 + 0.1 * lean))).join(''));

/** Note 0. Two round seed leaves, and the first pair of true leaves coming between them. */
function seedling() {
  const seedLeaves = placed([[-9, 22.5, 0.8], [166, 20.5, 0.7]]);
  const trueLeaves = placed([[82, 14.5, -1], [255, 12, 1]]);
  return [
    painted(together(seedLeaves, (at, length) => seedLeaf(at, length, 15.5)), tint(0)),
    inked(together(seedLeaves, (at, length) => rib(at, length, 0.3, 0.78))),
    painted(together(trueLeaves, (at, length) => leaf(at, length, 8)), tint(2)),
    inked(together(trueLeaves, (at, length) => rib(at, length, 0.25, 0.75))),
    seed(1.9),
  ];
}

/** Note 1. Three round clover leaflets, each with its pale chevron. */
function clover() {
  const leaflets = placed([[-4, 22, 0.4], [119, 17.5, -0.5], [243, 20, 0.5]]);
  const width = 19;
  const chevron = (at, length) => `M${at(length * 0.4, -width * 0.27)}Q${at(length * 0.74, 0)} ${at(length * 0.4, width * 0.27)}`;
  return [
    ...apart(leaflets, (at, length) => lobed(at, length, width, 0.08), tint(1)),
    faint(together(leaflets, chevron)),
    inked(together(leaflets, (at, length) => rib(at, length, 0.16, 0.52))),
    seed(1.8),
  ];
}

/** Note 2. A tuft of narrow blades, long and short, that arch over as they grow. */
function grassTuft() {
  const blades = placed([
    [-22, 28, 3], [62, 25, -2.6], [112, 22, 2.8], [176, 27, -2], [222, 23.5, 3], [292, 26, -2.6],
    [24, 14.5, 2.5], [148, 13, -3], [258, 15, 2.8],
  ]);
  return [
    ...apart(blades, (at, length) => blade(at, length, 6), tint(2)),
    faint(together(blades, (at, length) => rib(at, length, 0.2, 0.86))),
    seed(2),
  ];
}

/** Note 3. A flat rosette of toothed leaves. */
function toothedRosette() {
  const leaves = placed([[6, 27.5, 0.6], [80, 21, -0.8], [143, 25.5, 0.7], [211, 22.5, 0.9], [289, 26, -0.7]]);
  return [
    painted(together(leaves, (at, length) => toothed(at, length, 12.5)), tint(3)),
    inked(together(leaves, (at, length) => rib(at, length, 0.14, 0.86))),
    seed(2.4),
  ];
}

/** Note 4. A rosette of broad veined leaves, with young ones round a bud just showing at its heart. */
function rosetteInBud() {
  const leaves = whorl(5, 12, 24, 3);
  const young = whorl(3, 50, 11.5, 8);
  return [
    ...apart(leaves, (at, length) => leaf(at, length, 14), tint(4)),
    faint(together(leaves, (at, length) => veins(at, length, 14))),
    inked(together(leaves, (at, length) => rib(at, length, 0.16, 0.84))),
    ...apart(young, (at, length) => leaf(at, length, 8.4), tint(4)),
    inked(together(young, (at, length) => rib(at, length, 0.4, 0.8))),
    heart(3.2),
  ];
}

/** Note 5. A rosebud on its sepals: the petals are still wrapped round each other. */
function rosebud() {
  const leaves = whorl(3, 34, 26, 5);
  const sepals = whorl(5, 8, 17, 1);
  // The innermost petal is still furled, and sits a little off the middle.
  const furled = lie(MIDDLE - 1.2, MIDDLE + 1.6, 28, 4.6, 0.3);
  return [
    painted(together(leaves, (at, length) => leaf(at, length, 10)), tint(3)),
    inked(together(leaves, rib)),
    painted(together(sepals, (at, length) => leaf(at, length, 6.6)), tint(4)),
    faint(together(sepals, (at, length) => rib(at, length, 0.5, 0.8))),
    ...apart(whorl(3, 20, 11.6, 2), (at, length) => petal(at, length, 15.5), tint(5)),
    ...apart(whorl(3, 84, 7.8, 6), (at, length) => petal(at, length, 10.5), tint(5)),
    painted(petal(furled, 4.6, 5.2), tint(5)),
  ];
}

/**
 * Note 6. A wild rose, wide open: five broad petals round a heart of pollen.
 * This is the flower of the empty garden and of the app icon, which
 * scripts/make-icons.py draws again from the same numbers. Keep the two in step.
 */
function wildRose() {
  const leaves = whorl(3, 38, 27.5, 4);
  const petals = whorl(5, 2, 21.5, 0);
  const anthers = whorl(7, 14, 7.6, 8);
  return [
    painted(together(leaves, (at, length) => leaf(at, length, 10)), tint(3)),
    inked(together(leaves, rib)),
    ...apart(petals, (at, length) => lobed(at, length, 18, 0.08), tint(6)),
    faint(together(petals, (at, length) => rib(at, length, 0.34, 0.58)) + together(anthers, (at, length) => `M${at(5)}L${at(length)}`)),
    heart(5),
    stamens(anthers, 0.8),
  ];
}

/** Note 7. A cosmos: eight thin petals with fringed ends, and three leaf tips showing behind them. */
function cosmos() {
  const leaves = placed([[24, 29, 1], [156, 28, -0.9], [272, 28.5, 0.8]]);
  const petals = whorl(8, 0, 21.5, 9);
  return [
    painted(together(leaves, (at, length) => leaf(at, length, 6.4)), tint(4)),
    ...apart(petals, (at, length) => fringed(at, length, 15.6), tint(7)),
    faint(together(petals, (at, length) => rib(at, length, 0.36, 0.62))),
    heart(4.4),
    stamens(whorl(6, 20, 6.6, 3), 0.75),
  ];
}

/** Note 8. A daisy: a crowd of narrow white rays round a wide yellow eye. */
function daisy() {
  const rays = whorl(13, 6, 23.2, 2);
  return [
    ...apart(rays, (at, length) => petal(at, length, 5.8), tint(8)),
    faint(together(rays, (at, length) => rib(at, length, 0.42, 0.66))),
    heart(6.2),
    stamens(whorl(7, 10, 3.5, 5), 0.7),
  ];
}

/** The frilled rim of a daffodil's cup: `count` scallops round the middle. */
function frill(count, radius, hand) {
  const rim = (step, reach) => lie(MIDDLE, MIDDLE, (step * 360) / count)(reach);
  let d = `M${rim(0, radius)}`;
  for (let i = 0; i < count; i++) {
    d += `Q${rim(i + 0.5, radius * (1.2 + 0.05 * slip(hand + i)))} ${rim(i + 1, radius)}`;
  }
  return `${d}Z`;
}

/** Note 9. A daffodil: six pointed petals, three behind and three in front, and a frilled cup. */
function daffodil() {
  const petals = [...whorl(3, 8, 25.5, 6), ...whorl(3, 68, 24.5, 10)];
  return [
    ...apart(petals, (at, length) => leaf(at, length, 13.5), tint(9)),
    faint(together(petals, (at, length) => rib(at, length, 0.5, 0.78))),
    painted(frill(9, 8, 1), BUTTER),
    faint(dot(CENTRE, 0, 4.6)),
    stamens(whorl(6, 5, 2.5, 4), 0.7),
  ];
}

/** One plant per note: seedlings and leaves for the low notes, opening into paler blossoms for the high ones. */
const PLANTS = [seedling(), clover(), grassTuft(), toothedRosette(), rosetteInBud(), rosebud(), wildRose(), cosmos(), daisy(), daffodil()];

/** What each plant is called, lowest note first. Used in spoken labels. */
export const PLANT_NAMES = [
  'seedling',
  'clover',
  'grass tuft',
  'toothed rosette',
  'rosette in bud',
  'rosebud',
  'wild rose',
  'cosmos',
  'daisy',
  'daffodil',
];

/**
 * The drawing for a note: its marks, back to front. Each mark is one path `d`
 * with a `fill`, the `weight` of its ink outline (as a share of the usual
 * line, 0 for none) and the `opacity` of that ink.
 */
export function plantForNote(note) {
  return PLANTS[Math.min(NOTE_COUNT - 1, Math.max(0, note))] || PLANTS[0];
}

/** Which way round a plant sits, so that two of a kind never look stamped. */
export function turnFor(x, y) {
  return Math.round(x * 37 + y * 17) % 360;
}

function cubic(a, b, c, d, t) {
  const s = 1 - t;
  return {
    x: s * s * s * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * c[0] + t * t * t * d[0],
    y: s * s * s * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * c[1] + t * t * t * d[1],
    dx: 3 * s * s * (b[0] - a[0]) + 6 * s * t * (c[0] - b[0]) + 3 * t * t * (d[0] - c[0]),
    dy: 3 * s * s * (b[1] - a[1]) + 6 * s * t * (c[1] - b[1]) + 3 * t * t * (d[1] - c[1]),
  };
}

/**
 * A sprig of line-art: a curved stem with leaves taking turns on either side,
 * smaller towards the tip, and one last leaf at the end. Each leaf curves a
 * little, back towards the stem.
 */
export function sprig({ stem, count, length, width, spread = 50, first = 0.16, side = 1 }) {
  const [a, b, c, d] = stem;
  let outlines = '';
  let ribs = '';
  for (let i = 0; i <= count; i++) {
    const last = i === count;
    const t = last ? 1 : first + (i * (0.94 - first)) / count;
    const here = cubic(a, b, c, d, t);
    const heading = (Math.atan2(here.dx, -here.dy) * 180) / Math.PI;
    const out = i % 2 ? -side : side;
    const lean = last ? 0 : spread * out;
    const bend = last ? 0 : -0.08 * out;
    const size = 1 - 0.45 * t;
    outlines += leafPath(here.x, here.y, heading + lean, length * size, width * size, bend);
    ribs += ribPath(here.x, here.y, heading + lean, length * size, bend);
  }
  return {
    stem: `M${tidy(a[0])} ${tidy(a[1])}C${tidy(b[0])} ${tidy(b[1])} ${tidy(c[0])} ${tidy(c[1])} ${tidy(d[0])} ${tidy(d[1])}`,
    outlines,
    ribs,
  };
}
