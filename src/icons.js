import Svg, { Path, Rect } from 'react-native-svg';

import { leafPath } from './botany';
import { INK } from './theme';

// Small glyphs on a 24 x 24 grid, all drawn with one weight of line: 1.5 points
// when a glyph is 20 points across, as the ones on the buttons are.

const WEIGHT = 1.8;
const line = (color) => ({ fill: 'none', stroke: color, strokeWidth: WEIGHT, strokeLinecap: 'round', strokeLinejoin: 'round' });

export function PauseIcon({ size = 24, color = INK }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="6.6" y="5" width="3.6" height="14" rx="1.6" fill={color} />
      <Rect x="13.8" y="5" width="3.6" height="14" rx="1.6" fill={color} />
    </Svg>
  );
}

export function PlayIcon({ size = 24, color = INK }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8.6 6.1v11.8c0 .9 1 1.5 1.8.9l8.6-5.9c.7-.4.7-1.4 0-1.8l-8.6-5.9c-.8-.6-1.8 0-1.8.9z" fill={color} />
    </Svg>
  );
}

// The leaf leans to the upper right and curves a little, on a short stalk.
const LEAF = leafPath(6.4, 17.6, 45, 18, 10.4, 0.08);
const LEAF_RIB = 'M4 20C7.6 16.6 11.2 13.4 14.6 10.6';

/** A leaf with its rib. */
export function LeafIcon({ size = 24, color = INK }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={LEAF} {...line(color)} />
      <Path d={LEAF_RIB} {...line(color)} />
    </Svg>
  );
}

// Five seeds of mixed size, thrown from the left and falling in an arc. Each
// is [x, y, the way it points, length, width], measured from its blunt end.
const SEEDS = [
  [3.2, 17.6, 20, 7.2, 4.6],
  [6.6, 7.4, 70, 5.2, 3.4],
  [12.9, 3.6, 125, 6.6, 4.2],
  [19.2, 10.2, 165, 4.8, 3.1],
  [20.4, 17.4, 185, 4, 2.6],
]
  .map(([x, y, angle, length, width]) => leafPath(x, y, angle, length, width))
  .join('');

/** A handful of seeds in mid-air. */
export function SeedsIcon({ size = 24, color = INK }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={SEEDS} fill={color} />
    </Svg>
  );
}

/** A garden rake, leaning, for clearing the bed: a long handle, a head and four tines. */
export function RakeIcon({ size = 24, color = INK }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M21.1 2L11.15 13.9" {...line(color)} />
      <Path d="M6.1 9.65l10.1 8.5" {...line(color)} />
      <Path d="M6.1 9.65l-3.2 3.85M9.45 12.5l-3.2 3.85M12.85 15.3l-3.2 3.85M16.2 18.15l-3.2 3.85" {...line(color)} />
    </Svg>
  );
}

export function ArrowIcon({ size = 16, direction = 'up', color = INK }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={direction === 'up' ? 'M12 19.5V5M6 11l6-6 6 6' : 'M4.5 12H19M13 6l6 6-6 6'} {...line(color)} />
    </Svg>
  );
}
