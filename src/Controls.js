import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { PauseIcon, PlayIcon, RakeIcon, SeedsIcon } from './icons';
import { CARD, CARD_OFF, CARD_SHADOW, HAIRLINE, INK, INK_OFF, KEY_SHADOW, LEAF, PAPER } from './theme';

/** An arrow turning back, for putting plants back. Drawn like the glyphs in icons.js: 24 x 24, the same weight of line. */
function UndoIcon({ size = 24, color = INK }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M8.6 5.2 4.8 9l3.8 3.8M4.8 9h9.4a5.3 5.3 0 0 1 0 10.6H9.4"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * A quiet key: white paper with a hairline edge, an icon and a word. Pressed,
 * it stays white and its edge darkens. Switched off, it turns to plain paper
 * with paler ink, and stays opaque so nothing behind it shows through.
 */
function Pill({ icon: Icon, text, label, disabled, onPress, testID }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [styles.key, styles.pill, disabled ? styles.pillOff : CARD_SHADOW, pressed && styles.pillPressed]}
    >
      <Icon size={20} color={disabled ? INK_OFF : INK} />
      <Text
        style={[styles.label, disabled && styles.labelOff]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        maxFontSizeMultiplier={1.3}
      >
        {text}
      </Text>
    </Pressable>
  );
}

/**
 * Clear the bed on the left, play or pause in the middle, scatter a few seeds
 * on the right. For a few seconds after plants are taken away, Clear becomes
 * Undo. `bottom` is the height of the home bar or navigation bar below.
 */
function Controls({ playing, empty, canScatter, canUndo, bottom, onToggle, onClear, onUndo, onScatter, onLayout }) {
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(bottom, 14) + 2 }]} pointerEvents="box-none" onLayout={onLayout}>
      {canUndo ? (
        <Pill icon={UndoIcon} text="Undo" label="Undo. Put the plants back" onPress={onUndo} testID="undo" />
      ) : (
        <Pill icon={RakeIcon} text="Clear" label="Clear the garden" disabled={empty} onPress={onClear} testID="clear" />
      )}

      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause the garden' : 'Let the garden play'}
        testID="toggle"
        style={({ pressed }) => [styles.key, styles.round, pressed && styles.roundPressed]}
      >
        {playing ? <PauseIcon size={26} color={PAPER} /> : <PlayIcon size={26} color={PAPER} />}
      </Pressable>

      <Pill icon={SeedsIcon} text="Scatter" label="Scatter a few seeds" disabled={!canScatter} onPress={onScatter} testID="scatter" />
    </View>
  );
}

export default memo(Controls);

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  key: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  pill: {
    flex: 1,
    minWidth: 92,
    maxWidth: 132,
    minHeight: 50,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: HAIRLINE,
    backgroundColor: CARD,
  },
  pillPressed: { borderColor: LEAF, transform: [{ scale: 0.97 }] },
  pillOff: { backgroundColor: CARD_OFF },
  round: { width: 64, height: 64, borderRadius: 32, backgroundColor: LEAF, ...KEY_SHADOW },
  roundPressed: { backgroundColor: INK, transform: [{ scale: 0.95 }] },
  label: { flexShrink: 1, color: INK, fontSize: 15.5, fontWeight: '600', letterSpacing: -0.1 },
  labelOff: { color: INK_OFF },
});
