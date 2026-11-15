import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { PLANT_BOX, PLANT_NAMES, turnFor } from './botany';
import { NOTE_COUNT } from './garden';
import { USE_NATIVE_DRIVER, useValue } from './motion';
import PlantDrawing from './PlantDrawing';
import { BUTTER, FERN, INK, INK_SOFT, SERIF_ITALIC } from './theme';

const MIDDLE = PLANT_BOX / 2;
const SEED = 7;
/** How far a plant swells when it rings by itself or is tapped; an echo is a quarter of this. */
const SWELL = 0.18;
const TWIST = 9;
/** A resting plant draws in a little and pales. */
const REST_SCALE = 0.9;
const REST_INK = 0.75;
/** A plant that is pulled up lifts this far, in this long, and leaves a fine ring behind. */
const LIFT = 70;
const LIFT_MS = 600;
const PUFF = 120;
/** The ring that closes in while a plant is held starts and ends outside a fingertip. */
const HOLD_FROM = 120;
const HOLD_TO = 76;

/** Blossoms, from this note up, shed a little pollen when they ring by themselves or are tapped. */
const FIRST_BLOSSOM = 5;
const SPECK = 3;
const SPECKS = [
  { angle: 20, reach: 17 },
  { angle: 115, reach: 13 },
  { angle: 200, reach: 18 },
  { angle: 290, reach: 14 },
];

/** The notes are a five-note scale over two octaves; a new plant is captioned with the name of its note. */
const NOTE_NAMES = ['do', 're', 'mi', 'sol', 'la'];

const timing = (value, toValue, duration, easing) =>
  Animated.timing(value, { toValue, duration, easing, useNativeDriver: USE_NATIVE_DRIVER });

/** The values that move a plant when it rings. They are made once, with the seed. */
export function plantMotion() {
  return { nod: new Animated.Value(0), twist: new Animated.Value(0), shed: new Animated.Value(0) };
}

/**
 * Rings a plant: it swells quickly and settles back with a small sway. A
 * plant's own pulse also gives it a twist and shakes out its pollen; an echo
 * only makes it nod.
 */
export function ringPlant(seed, echo = false) {
  const swell = (value, size) =>
    Animated.sequence([
      timing(value, size, 70, Easing.out(Easing.quad)),
      Animated.spring(value, { toValue: 0, friction: 5, tension: 90, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  swell(seed.nod, echo ? 0.25 : 1);
  if (echo) return;
  swell(seed.twist, 1);
  seed.shed.setValue(0);
  timing(seed.shed, 1, 600, Easing.out(Easing.quad)).start();
}

/** What a screen reader calls the plant for a note. */
export function nameOfPlant(note) {
  return PLANT_NAMES[note] || 'plant';
}

/** A grain of pollen that drifts out from the heart of a blossom and fades. */
function Speck({ shed, angle, reach }) {
  const turn = (angle * Math.PI) / 180;
  const drift = (from, to) => shed.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  return (
    <Animated.View
      style={[
        styles.speck,
        {
          opacity: shed.interpolate({ inputRange: [0, 0.12, 0.6, 1], outputRange: [0, 1, 0.8, 0] }),
          transform: [
            { translateX: drift(5 * Math.sin(turn), reach * Math.sin(turn)) },
            { translateY: drift(-5 * Math.cos(turn), -reach * Math.cos(turn)) },
          ],
        },
      ]}
    />
  );
}

/**
 * A planted seed. It lands as a seed, then its leaves or petals unfurl around
 * it, and for a moment it is captioned with its note like a plate in a flora.
 * It swells each time it rings, draws in while the garden rests, and lifts off
 * the page when it is pulled up. With reduced motion it only fades in and out.
 */
function PlantedSeed({ seed, resting, leaving, still, onRing, onPull, onGone }) {
  const { id, x, y, note, nod, twist, shed } = seed;
  const grow = useValue(0);
  const rest = useValue(resting ? 1 : 0);
  const out = useValue(0);
  const caption = useValue(0);
  const [captioned, setCaptioned] = useState(true);
  const lifted = useRef(false);

  useEffect(() => {
    if (still) timing(grow, 1, 220, Easing.out(Easing.quad)).start();
    else Animated.spring(grow, { toValue: 1, friction: 6, tension: 48, useNativeDriver: USE_NATIVE_DRIVER }).start();
    // The caption comes up as the plant opens, stays a little over a second, and is then taken away for good.
    const label = Animated.sequence([
      Animated.delay(250),
      timing(caption, 1, 250, Easing.out(Easing.quad)),
      Animated.delay(1200),
      timing(caption, 0, 400, Easing.in(Easing.quad)),
    ]);
    label.start(({ finished }) => {
      if (finished) setCaptioned(false);
    });
    return () => label.stop();
    // A plant unfurls once, when it is planted, whatever changes later.
  }, [grow, caption]);

  useEffect(() => {
    timing(rest, resting ? 1 : 0, 500, Easing.inOut(Easing.quad)).start();
  }, [rest, resting]);

  // Leaving is animated here, on the plant itself. If the plant is put back
  // before it has gone, it settles down again where it stood.
  useEffect(() => {
    if (!leaving && !lifted.current) return undefined;
    lifted.current = leaving;
    const animation = timing(out, leaving ? 1 : 0, leaving ? (still ? 300 : LIFT_MS) : 250, Easing.out(Easing.cubic));
    animation.start(({ finished }) => {
      if (finished && leaving) onGone(id);
    });
    return () => animation.stop();
  }, [out, leaving, still, id, onGone]);

  const turn = turnFor(x, y);
  const name = nameOfPlant(note);

  return (
    <View
      pointerEvents="none"
      testID={leaving ? undefined : 'seed'}
      accessible={!leaving}
      accessibilityRole="button"
      accessibilityLabel={`${name[0].toUpperCase()}${name.slice(1)}, note ${note + 1} of ${NOTE_COUNT}`}
      accessibilityActions={ACTIONS}
      onAccessibilityAction={(event) => (event.nativeEvent.actionName === 'pull' ? onPull(id) : onRing(id))}
      style={[styles.anchor, { left: x - MIDDLE, top: y - MIDDLE }]}
    >
      {leaving && !still && (
        <Animated.View
          style={[
            styles.puff,
            {
              opacity: out.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
              transform: [{ scale: out.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }],
            },
          ]}
        />
      )}

      {/* Ringing and resting move the whole plant. */}
      <Animated.View
        style={{
          opacity: rest.interpolate({ inputRange: [0, 1], outputRange: [1, REST_INK] }),
          transform: [
            { scale: nod.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + SWELL] }) },
            { rotate: twist.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${still ? 0 : TWIST}deg`] }) },
            { scale: rest.interpolate({ inputRange: [0, 1], outputRange: [1, REST_SCALE] }) },
          ],
        }}
      >
        {/* Being pulled up lifts it away. */}
        <Animated.View
          style={
            still
              ? { opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }
              : {
                  opacity: out.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 0.75, 0] }),
                  transform: [
                    { translateY: out.interpolate({ inputRange: [0, 1], outputRange: [0, -LIFT] }) },
                    { rotate: out.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '40deg'] }) },
                    { scale: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) },
                  ],
                }
          }
        >
          {/* Being planted unfurls it. */}
          <Animated.View
            style={
              still
                ? { opacity: grow, transform: [{ rotate: `${turn}deg` }] }
                : {
                    transform: [
                      { rotate: `${turn}deg` },
                      { scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 1] }) },
                      { rotate: grow.interpolate({ inputRange: [0, 1], outputRange: ['-70deg', '0deg'] }) },
                    ],
                  }
            }
          >
            <PlantDrawing note={note} />
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {!still && (
        <Animated.View
          style={[styles.seed, { opacity: grow.interpolate({ inputRange: [0, 0.55, 0.9], outputRange: [1, 1, 0], extrapolate: 'clamp' }) }]}
        />
      )}
      {!still && !leaving && note >= FIRST_BLOSSOM && SPECKS.map((speck) => <Speck key={speck.angle} shed={shed} angle={speck.angle + turn} reach={speck.reach} />)}
      {captioned && !leaving && (
        <Animated.Text style={[styles.caption, { opacity: caption }]} maxFontSizeMultiplier={1.3}>
          {NOTE_NAMES[note % NOTE_NAMES.length]}
        </Animated.Text>
      )}
    </View>
  );
}

const ACTIONS = [
  { name: 'activate', label: 'Ring' },
  { name: 'pull', label: 'Pull up' },
];

export const Plant = memo(PlantedSeed);

/**
 * While a finger rests on a plant, a dashed ring closes in around it; when the
 * ring arrives the plant is pulled up. It is drawn in ink and dashed so it is
 * never mistaken for a ripple, and it stays wider than the fingertip. It is
 * always mounted and moved by `at` and `progress`, so showing it draws nothing again.
 */
export function HoldRing({ at, progress }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.holdRing,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0, 0.85] }),
          transform: [
            { translateX: at.x },
            { translateY: at.y },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, HOLD_TO / HOLD_FROM] }) },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', width: PLANT_BOX, height: PLANT_BOX },
  seed: {
    position: 'absolute',
    left: MIDDLE - SEED / 2,
    top: MIDDLE - SEED / 2,
    width: SEED,
    height: SEED,
    borderRadius: SEED / 2,
    backgroundColor: INK,
  },
  speck: {
    position: 'absolute',
    left: MIDDLE - SPECK / 2,
    top: MIDDLE - SPECK / 2,
    width: SPECK,
    height: SPECK,
    borderRadius: SPECK / 2,
    backgroundColor: BUTTER,
  },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: PLANT_BOX - 5,
    textAlign: 'center',
    color: INK_SOFT,
    fontFamily: SERIF_ITALIC,
    fontSize: 12,
    lineHeight: 15,
  },
  puff: {
    position: 'absolute',
    left: MIDDLE - PUFF / 2,
    top: MIDDLE - PUFF / 2,
    width: PUFF,
    height: PUFF,
    borderRadius: PUFF / 2,
    borderWidth: 1.2,
    borderColor: FERN,
    overflow: 'hidden',
  },
  holdRing: {
    position: 'absolute',
    left: -HOLD_FROM / 2,
    top: -HOLD_FROM / 2,
    width: HOLD_FROM,
    height: HOLD_FROM,
    borderRadius: HOLD_FROM / 2,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: INK,
  },
});
