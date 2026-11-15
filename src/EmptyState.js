import { memo, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { ArrowIcon } from './icons';
import { USE_NATIVE_DRIVER, useValue } from './motion';
import PlantDrawing from './PlantDrawing';
import { FERN, INK, INK_SOFT, SAGE, SERIF } from './theme';

const SPECIMEN_NOTE = 6;
/** The growth rings around the specimen are at most this wide, and shrink to fit a short screen. */
const DEMO_MAX = 224;
const DEMO_MIN = 120;
/** The height the invitation and the two rules need below the rings. */
const WORDS = 176;

function Rule({ direction, children }) {
  return (
    <View style={styles.rule}>
      <ArrowIcon size={14} direction={direction} color={SAGE} />
      <Text style={styles.ruleText} maxFontSizeMultiplier={1.3}>
        {children}
      </Text>
    </View>
  );
}

/**
 * Shown while nothing is planted: one blossom that keeps rippling, an
 * invitation, and the two rules. It fills the band between the header (`top`)
 * and the controls (`bottom`, measured up from the foot of the screen) and is
 * sized from it. It fades away when the first seed lands and fades back in
 * when the garden is empty again. With reduced motion the blossom stays still.
 */
function EmptyState({ visible, top, bottom, height, still }) {
  const fade = useValue(visible ? 1 : 0);
  const beat = useValue(0);
  const [shown, setShown] = useState(visible);

  useEffect(() => {
    if (visible) setShown(true);
    const animation = Animated.timing(fade, {
      toValue: visible ? 1 : 0,
      duration: visible ? 400 : 250,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: USE_NATIVE_DRIVER,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setShown(false);
    });
    return () => animation.stop();
  }, [fade, visible]);

  const moving = shown && !still;
  useEffect(() => {
    if (!moving) return undefined;
    beat.setValue(0);
    const loop = Animated.loop(Animated.timing(beat, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER }));
    loop.start();
    return () => loop.stop();
  }, [beat, moving]);

  if (!shown) return null;

  const demo = Math.min(DEMO_MAX, Math.max(DEMO_MIN, height - top - bottom - WORDS));
  const specimen = Math.round(demo * 0.46);
  const ring = (size, line, color, opacity) => ({
    left: (demo - size) / 2,
    top: (demo - size) / 2,
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: line,
    borderColor: color,
    opacity,
  });

  return (
    <Animated.View style={[styles.empty, { top, bottom, opacity: fade }]} pointerEvents="none">
      <View style={{ width: demo, height: demo, marginBottom: demo * 0.1 }}>
        <View style={[styles.ring, ring(demo, 1.15, SAGE, 0.4)]} />
        <View style={[styles.ring, ring(demo * 0.795, 1.15, SAGE, 0.6)]} />
        <View style={[styles.ring, ring(demo * 0.6, 1.15, SAGE, 0.85)]} />
        {moving && (
          <Animated.View
            style={[
              styles.ring,
              ring(demo, 1.3, FERN, 1),
              {
                opacity: beat.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.7, 0, 0] }),
                transform: [{ scale: beat.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.3, 1, 1] }) }],
              },
            ]}
          />
        )}
        <Animated.View
          style={[
            styles.specimen,
            {
              left: (demo - specimen) / 2,
              top: (demo - specimen) / 2,
              width: specimen,
              height: specimen,
              transform: [
                { scale: beat.interpolate({ inputRange: [0, 0.04, 0.3, 1], outputRange: [1, 1.1, 1, 1] }) },
                { rotate: beat.interpolate({ inputRange: [0, 0.04, 0.3, 1], outputRange: ['-18deg', '-12deg', '-18deg', '-18deg'] }) },
              ],
            },
          ]}
        >
          <PlantDrawing note={SPECIMEN_NOTE} size={specimen} />
        </Animated.View>
      </View>

      <Text style={styles.invitation} maxFontSizeMultiplier={1.3}>
        Tap anywhere to{'\n'}plant a sound
      </Text>
      <View style={styles.rules}>
        <Rule direction="up">Higher up, higher notes</Rule>
        <Rule direction="right">Further right, slower beats</Rule>
      </View>
    </Animated.View>
  );
}

export default memo(EmptyState);

const styles = StyleSheet.create({
  empty: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  ring: { position: 'absolute', overflow: 'hidden' },
  specimen: { position: 'absolute' },
  invitation: { color: INK, fontFamily: SERIF, fontSize: 28, lineHeight: 35, letterSpacing: -0.3, textAlign: 'center' },
  rules: { alignItems: 'center', gap: 6, marginTop: 16 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText: { color: INK_SOFT, fontSize: 13.5, lineHeight: 18, fontWeight: '500' },
});
