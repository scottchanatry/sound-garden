// The look of the garden: a botanical print. Cream paper, leaf-green ink for
// every line and letter, and two quiet tints (blush and butter) for the blossoms.

export const PAPER = '#FDFBF3';
export const PAPER_MID = '#F8F9EE';
export const PAPER_SAGE = '#E9F4E0';
export const CARD = '#FFFEFA';
/** A control that is switched off: opaque, never see-through. */
export const CARD_OFF = '#F4F6EC';

/** Deep leaf green: text and every drawn outline. */
export const INK = '#1F3D2E';
export const INK_SOFT = '#48614F';
/** Label and icon of a control that is switched off. */
export const INK_OFF = '#8FA394';
/** The one filled control. */
export const LEAF = '#2E7350';
/** Ripples. */
export const FERN = '#4A8A63';
/** Echoes and quiet marks. */
export const SAGE = '#7FA283';
/** Borders and the line-art at the edges of the page. */
export const HAIRLINE = '#C6D3BA';
/** The soft green that pools at the edges of the paper. */
export const WASH = '#A8D6A4';

/** The pollen at the heart of a blossom. */
export const BUTTER = '#F0D27C';

/** The weight of a drawn line, in points, for plants, ripples and line-art. */
export const LINE = 1.15;

/**
 * The title face, Fraunces, loaded in App.js from assets/fonts under these two
 * names on every platform. Body text stays in the system face.
 */
export const SERIF = 'Fraunces';
export const SERIF_ITALIC = 'Fraunces-Italic';

/** Fills its parent. (React Native 0.88 has no StyleSheet.absoluteFillObject.) */
export const FILL = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 };

/** One shadow for every card, the same on iOS, Android and the web. */
export const CARD_SHADOW = { boxShadow: '0px 4px 10px rgba(46, 115, 80, 0.10)' };
/** The filled play button sits a little higher. */
export const KEY_SHADOW = { boxShadow: '0px 6px 12px rgba(46, 115, 80, 0.16)' };

/** A see-through wash of a `#RRGGBB` colour. */
export function wash(hex, alpha) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
