import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { BED_GAP } from './garden';
import { PAPER, PAPER_SAGE, wash } from './theme';

// How solid a scrim is across its fading edge, from the solid side to the
// clear side. The ease at both ends keeps the edge from showing as a line.
const FADE = [1, 0.84, 0.5, 0.16, 0];

/** The colours and stops of a scrim that is solid for `solid` points and then fades out over `fade` points. */
function fading(color, solid, fade) {
  const length = solid + fade;
  return {
    colors: [color, ...FADE.map((alpha) => wash(color, alpha))],
    locations: [0, ...FADE.map((_, index) => (solid + (fade * index) / (FADE.length - 1)) / length)],
  };
}

// The lower scrim runs upwards: solid at the foot of the screen, clear at the bed.
const BOTTOM = { x: 0.5, y: 1 };
const TOP = { x: 0.5, y: 0 };

/**
 * Two sheets of paper laid over the ripples: one behind the header and one
 * behind the controls. Each is solid where the text or the buttons are and
 * fades to clear before the planting bed begins, so a ring fades out before
 * it can cross a word or a button. Plants are drawn above them.
 */
function Scrims({ headerBottom, controlsTop, height }) {
  const footer = height - controlsTop;
  const upper = fading(PAPER, headerBottom, BED_GAP);
  const lower = fading(PAPER_SAGE, footer, BED_GAP);

  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={upper.colors}
        locations={upper.locations}
        style={[styles.scrim, { top: 0, height: headerBottom + BED_GAP }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={lower.colors}
        locations={lower.locations}
        start={BOTTOM}
        end={TOP}
        style={[styles.scrim, { bottom: 0, height: footer + BED_GAP }]}
      />
    </>
  );
}

export default memo(Scrims);

const styles = StyleSheet.create({
  scrim: { position: 'absolute', left: 0, right: 0 },
});
