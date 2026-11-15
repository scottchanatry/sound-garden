import { memo } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { ECHO_REACH, RIPPLE_REACH, RIPPLE_SPEED } from './garden';
import { FERN, SAGE } from './theme';

// A ripple is one fine ring that spreads from a plant and fades as it goes.
//
// A ring is a round view with a border, drawn at its full size and scaled up
// from almost nothing, so its line would thicken as it grew. To keep the line
// fine at every age, a ring is drawn as a few views of the same size with
// different border widths, one on top of the other, that hand over to each
// other: the widest border while the ring is small, the narrowest when it is
// full size. No view is ever seen wider than about 1.3 points on the page.
//
// Each view is childless and clips its contents, which lets an iPhone draw the
// border as a vector line. Only transform and opacity ever change.

/** The value of a curve, given as [progress, value] points, at `progress`. */
function valueAt(curve, progress) {
  if (progress <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [end, endValue] = curve[i];
    if (progress <= end) {
      const [start, startValue] = curve[i - 1];
      return startValue + ((endValue - startValue) * (progress - start)) / (end - start);
    }
  }
  return curve[curve.length - 1][1];
}

/** How see-through one view of a ring is over its life: the ring's strength times that view's share of it. */
function opacityOf(strength, share) {
  const stops = [...new Set([...strength, ...share].map(([progress]) => progress))].sort((a, b) => a - b);
  return {
    inputRange: stops,
    outputRange: stops.map((progress) => Math.round(valueAt(strength, progress) * valueAt(share, progress) * 1000) / 1000),
  };
}

/** The views of one ring. `inset` draws it that far inside the ripple's edge, at full size. */
function ring(reach, strength, lines, inset = 0) {
  return lines.map(({ line, share }) => ({ radius: reach - inset, line, opacity: opacityOf(strength, share) }));
}

// A pulse, from a plant's own beat or a tap: a lead ring that is strongest when
// born and faint by half reach, and one follower close behind it that is gone
// by a third of the way.
const LEAD = [[0, 0], [0.03, 0.78], [0.2, 0.55], [0.5, 0.28], [0.82, 0.07], [1, 0]];
const FOLLOWER = [[0, 0], [0.06, 0.34], [0.18, 0.2], [0.32, 0]];
const PULSE = {
  color: FERN,
  from: 0.03,
  life: (RIPPLE_REACH / RIPPLE_SPEED) * 1000,
  rings: [
    ...ring(RIPPLE_REACH, LEAD, [
      { line: 5, share: [[0, 1], [0.16, 1], [0.27, 0]] },
      { line: 2.2, share: [[0.16, 0], [0.27, 1], [0.47, 1], [0.6, 0]] },
      { line: 1.3, share: [[0.47, 0], [0.6, 1], [1, 1]] },
    ]),
    ...ring(RIPPLE_REACH, FOLLOWER, [{ line: 3.4, share: [[0, 1]] }], 30),
  ],
};

// An echo, from a plant that another one's ripple has reached: a single, fainter, smaller ring.
const ECHO = {
  color: SAGE,
  from: 0.03,
  life: (ECHO_REACH / RIPPLE_SPEED) * 1000,
  rings: ring(ECHO_REACH, [[0, 0], [0.1, 0.46], [0.5, 0.24], [0.9, 0.05], [1, 0]], [
    { line: 3, share: [[0, 1], [0.28, 1], [0.42, 0]] },
    { line: 1.3, share: [[0.28, 0], [0.42, 1], [1, 1]] },
  ]),
};

// With reduced motion a pulse does not travel: one ring fades where it stands, just outside the plant.
const STILL = {
  color: FERN,
  from: 0.88,
  life: 900,
  rings: ring(46, [[0, 0], [0.12, 0.6], [1, 0]], [{ line: 1.3, share: [[0, 1]] }]),
};

/** How a ripple is drawn. With reduced motion echoes are not drawn at all. */
export function lookFor(echo, still) {
  if (still) return echo ? null : STILL;
  return echo ? ECHO : PULSE;
}

function Ripple({ ripple }) {
  const { x, y, look, progress } = ripple;
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [look.from, 1] });

  return look.rings.map(({ radius, line, opacity }, index) => (
    <Animated.View
      key={index}
      pointerEvents="none"
      style={[
        styles.ring,
        {
          left: x - radius,
          top: y - radius,
          width: radius * 2,
          height: radius * 2,
          borderRadius: radius,
          borderWidth: line,
          borderColor: look.color,
          opacity: progress.interpolate(opacity),
          transform: [{ scale }],
        },
      ]}
    />
  ));
}

export default memo(Ripple);

const styles = StyleSheet.create({
  ring: { position: 'absolute', overflow: 'hidden' },
});
