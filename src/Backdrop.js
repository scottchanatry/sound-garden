import { memo, useEffect, useMemo } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { sprig } from './botany';
import { USE_NATIVE_DRIVER, useValue } from './motion';
import { HAIRLINE, LINE, PAPER, PAPER_MID, PAPER_SAGE, SAGE, WASH, wash } from './theme';

// A wash is drawn small and scaled up, which keeps it cheap: it is only a soft
// blur of green. The lower one is the weaker, so the foot of the page stays bright.
const WASH_SIZE = 150;
const WASHES = [
  { id: 'wash-low', strength: 0.2, left: '0%', top: '64%', grow: 3.2 },
  { id: 'wash-high', strength: 0.22, left: '100%', top: '40%', grow: 3.2 },
];

// Two sprigs of line-art lean in from the edges of the page: one climbing the
// left edge, one hanging down the right. Each is drawn in its own small frame.
const SPRIG_FRAME = { width: 120, height: 270 };
const CLIMBING = sprig({
  stem: [[-12, 268], [6, 196], [8, 116], [62, 34]],
  count: 7,
  length: 40,
  width: 15,
  spread: 52,
});
const HANGING = sprig({
  stem: [[132, 2], [112, 70], [116, 150], [66, 232]],
  count: 6,
  length: 38,
  width: 14,
  spread: 54,
  side: -1,
});

/** A value that sways slowly between 0 and 1 for ever, or stays where it is while `still`. */
function useSway(duration, still) {
  const sway = useValue(0);
  useEffect(() => {
    if (still) return undefined;
    const leg = (toValue) => Animated.timing(sway, { toValue, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE_DRIVER });
    const loop = Animated.loop(Animated.sequence([leg(1), leg(0)]));
    loop.start();
    return () => loop.stop();
  }, [sway, duration, still]);
  return sway;
}

const Sprig = memo(function Sprig({ art, style, sway, lean }) {
  const rotate = useMemo(
    () => sway.interpolate({ inputRange: [0, 1], outputRange: [`${-lean}deg`, `${lean}deg`] }),
    [sway, lean]
  );
  return (
    <Animated.View style={[styles.sprig, style, { transform: [{ rotate }] }]}>
      <Svg width={SPRIG_FRAME.width} height={SPRIG_FRAME.height}>
        <Path d={art.outlines} fill={wash(SAGE, 0.1)} stroke={HAIRLINE} strokeWidth={LINE} strokeLinejoin="round" />
        <Path d={art.stem + art.ribs} fill="none" stroke={HAIRLINE} strokeWidth={LINE} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
});

/**
 * Cream paper with a breath of green, and a little leaf line-art at the edges
 * that stirs in the air. With `still`, nothing moves.
 */
function Backdrop({ still = false }) {
  const slow = useSway(11000, still);
  const slower = useSway(14000, still);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[PAPER, PAPER_MID, PAPER_SAGE]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      {WASHES.map((item) => (
        <View key={item.id} style={[styles.wash, { left: item.left, top: item.top, transform: [{ scale: item.grow }] }]}>
          <Svg width={WASH_SIZE} height={WASH_SIZE}>
            <Defs>
              <RadialGradient id={item.id} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={WASH} stopOpacity={item.strength} />
                <Stop offset="0.35" stopColor={WASH} stopOpacity={item.strength * 0.6} />
                <Stop offset="0.7" stopColor={WASH} stopOpacity={item.strength * 0.18} />
                <Stop offset="1" stopColor={WASH} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={WASH_SIZE / 2} cy={WASH_SIZE / 2} r={WASH_SIZE / 2} fill={`url(#${item.id})`} />
          </Svg>
        </View>
      ))}
      <Sprig art={CLIMBING} style={styles.climbing} sway={slow} lean={1.4} />
      <Sprig art={HANGING} style={styles.hanging} sway={slower} lean={1.2} />
    </View>
  );
}

export default memo(Backdrop);

const styles = StyleSheet.create({
  wash: {
    position: 'absolute',
    width: WASH_SIZE,
    height: WASH_SIZE,
    marginLeft: -WASH_SIZE / 2,
    marginTop: -WASH_SIZE / 2,
  },
  sprig: { position: 'absolute', width: SPRIG_FRAME.width, height: SPRIG_FRAME.height },
  climbing: { left: -10, top: '52%' },
  hanging: { right: -10, top: '14%' },
});
