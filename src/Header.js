import { memo, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { MAX_SEEDS } from './garden';
import { LeafIcon } from './icons';
import { USE_NATIVE_DRIVER, useValue } from './motion';
import { CARD, HAIRLINE, INK, INK_SOFT, LEAF, PAPER, SERIF, SERIF_ITALIC } from './theme';

// Each hint is two short phrases around a middle dot. The spaces inside a phrase
// do not break, so on a narrow phone the line wraps at the dot and nowhere else.
const NBSP = '\u00A0';
const hint = (first, second) => `${first.replace(/ /g, NBSP)} · ${second.replace(/ /g, NBSP)}`;

const RULES = hint('Higher up, higher notes', 'right, slower beats');

/** The line of help: the two rules for the first plants, then the gestures, and always the state of the garden. */
function hintFor(count, playing) {
  const full = count >= MAX_SEEDS;
  if (!playing) {
    if (full) return hint('Full and resting', 'hold a plant to pull it up');
    if (count === 0) return hint('Resting', 'press play to wake the garden');
    return hint('Resting', 'tap a plant to ring it by hand');
  }
  if (count === 0) return `A quiet instrument that grows ${'as you plant it'.replace(/ /g, NBSP)}`;
  if (count <= 2) return RULES;
  if (full) return hint('The garden is full', 'hold a plant to pull it up');
  return hint('Tap a plant to ring it', 'hold to pull it up');
}

/** The hint line. A new hint fades in over the old one instead of jumping. */
function Hint({ text }) {
  const [shown, setShown] = useState(text);
  const fade = useValue(1);
  const to = (toValue) => Animated.timing(fade, { toValue, duration: 75, easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER });

  // Starting a fade stops the one before it, so a hint that changes again mid-fade is simply skipped.
  useEffect(() => {
    if (text === shown) return;
    to(0).start(({ finished }) => {
      if (finished) setShown(text);
    });
  }, [text, shown]);
  useEffect(() => {
    to(1).start();
  }, [shown]);

  return (
    <Animated.Text style={[styles.hint, styles.seen, { opacity: fade }]} maxFontSizeMultiplier={1.3}>
      {shown}
    </Animated.Text>
  );
}

/**
 * The wordmark, a line of help that follows what is going on, and how many
 * seeds are planted. `top` is the height of the status bar or notch above it.
 * `nudge` shakes the tally when a seed is refused because the garden is full.
 */
function Header({ count, playing, top, nudge, onLayout }) {
  const full = count >= MAX_SEEDS;

  return (
    <View style={[styles.header, { paddingTop: Math.max(top, 20) + 11 }]} pointerEvents="box-none" onLayout={onLayout}>
      <View style={styles.row}>
        <Text
          style={styles.title}
          accessibilityRole="header"
          accessibilityLabel="Sound Garden"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          maxFontSizeMultiplier={1.2}
        >
          Sound <Text style={styles.italic}>Garden</Text>
        </Text>

        <Animated.View
          style={[
            styles.tally,
            full && styles.tallyFull,
            { transform: [{ translateX: nudge.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] }) }] },
          ]}
          accessible
          accessibilityLabel={`${count} of ${MAX_SEEDS} seeds planted${full ? '. The garden is full' : ''}`}
        >
          <LeafIcon size={16} color={full ? PAPER : INK} />
          <Text style={[styles.count, full && styles.countFull]} maxFontSizeMultiplier={1.3} testID="count">
            {count} / {MAX_SEEDS}
          </Text>
        </Animated.View>
      </View>

      {/* The longest hint, unseen, keeps the header the same height whatever the hint says, so the bed below never moves. */}
      <View>
        <Text style={[styles.hint, styles.unseen]} maxFontSizeMultiplier={1.3} accessibilityElementsHidden importantForAccessibility="no">
          {RULES}
        </Text>
        <Hint text={hintFor(count, playing)} />
      </View>
    </View>
  );
}

export default memo(Header);

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flexShrink: 1, color: INK, fontFamily: SERIF, fontSize: 25, lineHeight: 34, letterSpacing: -0.2 },
  italic: { fontFamily: SERIF_ITALIC },
  hint: { color: INK_SOFT, fontSize: 13.5, lineHeight: 18, fontWeight: '500', marginTop: 4 },
  unseen: { opacity: 0 },
  seen: { position: 'absolute', top: 0, left: 0, right: 0 },
  tally: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: CARD,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: HAIRLINE,
    minHeight: 34,
    paddingVertical: 6,
    paddingLeft: 9,
    paddingRight: 12,
  },
  tallyFull: { backgroundColor: LEAF, borderColor: LEAF },
  count: { color: INK, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  countFull: { color: PAPER },
});
