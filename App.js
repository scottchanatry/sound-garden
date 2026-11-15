import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Backdrop from './src/Backdrop';
import Controls from './src/Controls';
import EmptyState from './src/EmptyState';
import Header from './src/Header';
import RippleLayer from './src/RippleLayer';
import Scrims from './src/Scrims';
import { HoldRing, Plant, nameOfPlant, plantMotion, ringPlant } from './src/Plant';
import {
  MAX_SEEDS,
  RING_RADIUS,
  bandOfBed,
  bedBetween,
  distance,
  noteForY,
  periodForX,
  placeInBed,
  reached,
  scatter,
  seedAt,
  wakingOrder,
} from './src/garden';
import { useInsets } from './src/layout';
import { USE_NATIVE_DRIVER, announce, haptic, useReducedMotion, useValue } from './src/motion';
import { prepareSound, releaseSound, ring } from './src/sound';
import { FILL, PAPER, SERIF, SERIF_ITALIC } from './src/theme';

const FONTS = {
  [SERIF]: require('./assets/fonts/Fraunces-Regular.ttf'),
  [SERIF_ITALIC]: require('./assets/fonts/Fraunces-Italic.ttf'),
};

/** A plant is pulled up when it has been held this long, unless the finger slips further than HOLD_SLIP points. */
const HOLD_MS = 650;
const HOLD_SLIP = 12;
const SCATTER_SEEDS = 6;
const SCATTER_GAP_MS = 220;
/** After Play, the plants ring one after another, this far apart, so the garden is heard at once. */
const WAKE_MS = 120;
const WAKE_GAP_MS = 150;
/** How long Undo is offered after plants are taken away. It ignores the first moment, in case Clear was tapped twice. */
const UNDO_MS = 5000;
const UNDO_GUARD_MS = 350;

const BED_ACTIONS = [
  { name: 'activate' },
  { name: 'low', label: 'Plant a low note' },
  { name: 'middle', label: 'Plant a middle note' },
  { name: 'high', label: 'Plant a high note' },
];
const BANDS = { low: 0, middle: 1, high: 2 };

let nextId = 1;

// The splash screen stays up until the title face is ready.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [loaded, failed] = useFonts(FONTS);
  const ready = loaded || failed != null;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return <View style={styles.screen} />;

  return (
    <SafeAreaProvider>
      <Garden />
    </SafeAreaProvider>
  );
}

function Garden() {
  const insets = useInsets();
  const still = useReducedMotion();

  const [seeds, setSeeds] = useState([]);
  const [leaving, setLeaving] = useState([]);
  const [playing, setPlaying] = useState(true);
  const [scattering, setScattering] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [screen, setScreen] = useState({ width: 0, height: 0 });
  const [headerBottom, setHeaderBottom] = useState(0);
  const [controlsTop, setControlsTop] = useState(0);

  // The planting bed is known once the header and the controls have been measured.
  const bed = useMemo(
    () => (screen.width > 0 && headerBottom > 0 && controlsTop > 0 ? bedBetween(screen.width, headerBottom, controlsTop) : null),
    [screen.width, headerBottom, controlsTop]
  );

  // The latest values, for touches and for timers that fire later.
  const seedsRef = useRef(seeds);
  const playingRef = useRef(playing);
  const bedRef = useRef(bed);
  bedRef.current = bed;

  const ripples = useRef(null);
  const timers = useRef(new Set());
  const beats = useRef(new Map());
  const pending = useRef([]);
  const undo = useRef({ seeds: [], timer: null, since: 0 });
  const touch = useRef(null);

  const nudge = useValue(0);
  const holdProgress = useValue(0);
  const holdAt = useState(() => new Animated.ValueXY())[0];

  const setGarden = useCallback((next) => {
    seedsRef.current = next;
    setSeeds(next);
  }, []);

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  useEffect(() => {
    const waiting = timers.current;
    const beating = beats.current;
    return () => {
      waiting.forEach(clearTimeout);
      beating.forEach(clearTimeout);
      clearTimeout(undo.current.timer);
      releaseSound();
    };
  }, []);

  // A seed sounds its note and sends out a ripple. A full pulse reaches other
  // seeds, and each one it reaches answers with a quieter echo. Echoes do not
  // spread further, so the garden always settles.
  const pulse = useCallback(
    (id, echo = false) => {
      const seed = seedsRef.current.find((item) => item.id === id);
      if (!seed) return;

      ring(seed.note, echo ? 0.35 : 0.9);
      if (ripples.current) ripples.current.add(seed.x, seed.y, echo);
      ringPlant(seed, echo);

      if (!echo) {
        for (const hit of reached(seed, seedsRef.current)) {
          later(() => pulse(hit.id, true), hit.delay);
        }
      }
    },
    [later]
  );

  // Every seed keeps its own slow beat on its own timer, so planting or
  // pulling up one plant never disturbs the others.
  const startBeat = useCallback(
    (seed, wait) => {
      const timer = setTimeout(() => {
        pulse(seed.id);
        startBeat(seed, seed.period);
      }, wait);
      beats.current.set(seed.id, timer);
    },
    [pulse]
  );

  const stopBeat = useCallback((id) => {
    clearTimeout(beats.current.get(id));
    beats.current.delete(id);
  }, []);

  const stopAllBeats = useCallback(() => {
    beats.current.forEach(clearTimeout);
    beats.current.clear();
  }, []);

  /** Starts the beats of plants that were resting: a quick rising run, then each keeps its own time. */
  const wake = useCallback(
    (sleepers) => {
      wakingOrder(sleepers).forEach((seed, index) => startBeat(seed, WAKE_MS + index * WAKE_GAP_MS));
    },
    [startBeat]
  );

  const toggle = useCallback(() => {
    prepareSound();
    const next = !playingRef.current;
    playingRef.current = next;
    setPlaying(next);
    if (next) wake(seedsRef.current);
    else stopAllBeats();
    announce(next ? 'Garden playing' : 'Garden resting');
  }, [stopAllBeats, wake]);

  /** Something that cannot be done, because the garden is full or has no room: the tally shakes its head. */
  const refuse = useCallback(
    (reason = 'The garden is full') => {
      haptic.warning();
      const step = (toValue, duration) =>
        Animated.timing(nudge, { toValue, duration, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER });
      Animated.sequence([step(1, 60), step(-1, 90), step(0.5, 70), step(0, 60)]).start();
      announce(reason);
    },
    [nudge]
  );

  const plant = useCallback(
    (place, quiet = false) => {
      const ground = bedRef.current;
      if (!ground || seedsRef.current.length >= MAX_SEEDS) return;
      const seed = {
        id: nextId++,
        x: place.x,
        y: place.y,
        note: noteForY(place.y, ground),
        period: periodForX(place.x, ground),
        ...plantMotion(),
      };
      setGarden([...seedsRef.current, seed]);
      pulse(seed.id);
      if (playingRef.current) startBeat(seed, seed.period);
      if (!quiet) announce(`Planted a ${nameOfPlant(seed.note)}, ${seedsRef.current.length} of ${MAX_SEEDS}`);
    },
    [pulse, setGarden, startBeat]
  );

  // For a few seconds after plants are taken away they can be put back.
  const endUndo = useCallback(() => {
    clearTimeout(undo.current.timer);
    undo.current = { seeds: [], timer: null, since: 0 };
    setCanUndo(false);
  }, []);

  const offerUndo = useCallback(
    (gone) => {
      clearTimeout(undo.current.timer);
      undo.current = { seeds: [...undo.current.seeds, ...gone], timer: setTimeout(endUndo, UNDO_MS), since: Date.now() };
      setCanUndo(true);
    },
    [endUndo]
  );

  const restore = useCallback(() => {
    if (Date.now() - undo.current.since < UNDO_GUARD_MS) return;
    // Plants go back where they stood, unless something has been planted there since.
    const back = [];
    for (const seed of undo.current.seeds) {
      const taken = [...seedsRef.current, ...back];
      if (taken.length < MAX_SEEDS && !seedAt(seed, taken, RING_RADIUS)) back.push(seed);
    }
    endUndo();
    if (back.length === 0) return;
    setLeaving((list) => list.filter((seed) => !back.includes(seed)));
    setGarden([...seedsRef.current, ...back]);
    if (playingRef.current) wake(back);
    haptic.tick();
    announce(back.length === 1 ? 'Plant put back' : `${back.length} plants put back`);
  }, [endUndo, setGarden, wake]);

  // Plants that are taken away are seen to go: each one lifts off the page, then is dropped from the list.
  const dropLeaving = useCallback((id) => {
    setLeaving((list) => list.filter((seed) => seed.id !== id));
  }, []);

  const remove = useCallback(
    (id) => {
      const seed = seedsRef.current.find((item) => item.id === id);
      if (!seed) return;
      stopBeat(id);
      setGarden(seedsRef.current.filter((item) => item.id !== id));
      setLeaving((list) => [...list, seed]);
      offerUndo([seed]);
      announce(`Pulled up the ${nameOfPlant(seed.note)}, ${seedsRef.current.length} of ${MAX_SEEDS} left`);
    },
    [offerUndo, setGarden, stopBeat]
  );

  /** Empties the bed and stops everything still to come: echoes on their way and seeds still in the air. A cleared garden is ready to play. */
  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    pending.current = [];
    setScattering(false);
    stopAllBeats();

    const gone = seedsRef.current;
    setGarden([]);
    setLeaving((list) => [...list, ...gone]);
    offerUndo(gone);
    playingRef.current = true;
    setPlaying(true);
    announce('Garden cleared');
  }, [offerUndo, setGarden, stopAllBeats]);

  // Scatters a few well-spaced seeds one after another, lowest note first, so a
  // newcomer hears the garden at once. The button is off until they have all landed.
  const scatterSeeds = useCallback(() => {
    prepareSound();
    const ground = bedRef.current;
    if (!ground) return;
    const count = Math.min(SCATTER_SEEDS, MAX_SEEDS - seedsRef.current.length);
    const places = scatter(count, seedsRef.current, ground);
    if (places.length === 0) {
      refuse('No room to scatter more seeds');
      return;
    }
    pending.current = places;
    setScattering(true);
    places.forEach((place, index) => {
      later(() => {
        pending.current = pending.current.filter((other) => other !== place);
        // A place is skipped if a plant was tapped in beside it while it was in the air.
        if (!seedAt(place, seedsRef.current, RING_RADIUS)) plant(place, true);
        if (index === places.length - 1) setScattering(false);
      }, index * SCATTER_GAP_MS);
    });
    haptic.light();
    announce(`Scattering ${places.length} seeds`);
  }, [later, plant, refuse]);

  // For screen readers the bed plants a seed by itself: anywhere, or in its low, middle or high third.
  const onBedAction = useCallback(
    (event) => {
      const ground = bedRef.current;
      if (!ground) return;
      prepareSound();
      const band = BANDS[event.nativeEvent.actionName];
      const area = band == null ? ground : bandOfBed(ground, band);
      const [place] = seedsRef.current.length < MAX_SEEDS ? scatter(1, [...seedsRef.current, ...pending.current], area) : [];
      if (place) plant(place);
      else refuse(seedsRef.current.length >= MAX_SEEDS ? undefined : 'No room for a seed there');
    },
    [plant, refuse]
  );

  // Touch: tap open ground to plant, tap a plant to ring it, hold a plant to pull it up.
  const endHold = useCallback(() => {
    holdProgress.stopAnimation();
    holdProgress.setValue(0);
  }, [holdProgress]);

  const onTouchStart = useCallback(
    (event) => {
      prepareSound();
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      const seed = seedAt(point, seedsRef.current);
      const current = { point, seedId: seed ? seed.id : null, over: false, timer: null };
      if (seed) {
        holdAt.setValue({ x: seed.x, y: seed.y });
        holdProgress.setValue(0);
        Animated.timing(holdProgress, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER }).start();
        current.timer = setTimeout(() => {
          current.over = true;
          haptic.warning();
          endHold();
          remove(seed.id);
        }, HOLD_MS);
      }
      touch.current = current;
    },
    [endHold, holdAt, holdProgress, remove]
  );

  // A finger that slides off a plant has changed its mind: the plant is neither pulled up nor rung.
  const onTouchMove = useCallback(
    (event) => {
      const current = touch.current;
      if (!current || current.over || current.seedId == null) return;
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      if (distance(point, current.point) > HOLD_SLIP) {
        clearTimeout(current.timer);
        current.over = true;
        endHold();
      }
    },
    [endHold]
  );

  const onTouchEnd = useCallback(() => {
    const current = touch.current;
    touch.current = null;
    if (!current) return;
    clearTimeout(current.timer);
    if (current.over) return;
    endHold();

    if (current.seedId != null) {
      haptic.tick();
      pulse(current.seedId);
      return;
    }
    // Open ground only counts inside the bed. A tap beside a plant rings that plant.
    const place = bedRef.current ? placeInBed(current.point, bedRef.current) : null;
    if (!place) return;
    const beside = seedAt(place, seedsRef.current, RING_RADIUS);
    if (beside) {
      haptic.tick();
      pulse(beside.id);
    } else if (seedsRef.current.length >= MAX_SEEDS) {
      refuse();
    } else {
      haptic.tick();
      plant(place);
    }
  }, [endHold, plant, pulse, refuse]);

  const onTouchCancel = useCallback(() => {
    if (touch.current) clearTimeout(touch.current.timer);
    touch.current = null;
    endHold();
  }, [endHold]);

  const onScreenLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    setScreen((size) => (size.width === width && size.height === height ? size : { width, height }));
  }, []);
  const onHeaderLayout = useCallback((event) => {
    const { y, height } = event.nativeEvent.layout;
    setHeaderBottom(Math.round(y + height));
  }, []);
  const onControlsLayout = useCallback((event) => {
    setControlsTop(Math.round(event.nativeEvent.layout.y));
  }, []);

  const count = seeds.length;

  // Bottom to top: paper, ripples, the two scrims that fade them out, the
  // ground with its plants, then the header and the controls.
  return (
    <View style={styles.screen} onLayout={onScreenLayout}>
      <StatusBar style="dark" />
      <Backdrop still={still} />
      <RippleLayer ref={ripples} still={still} />
      {bed && <Scrims headerBottom={headerBottom} controlsTop={controlsTop} height={screen.height} />}
      {bed && (
        <EmptyState
          visible={count === 0 && leaving.length === 0}
          top={headerBottom}
          bottom={screen.height - controlsTop}
          height={screen.height}
          still={still}
        />
      )}

      <View
        style={styles.ground}
        onStartShouldSetResponder={() => true}
        onResponderGrant={onTouchStart}
        onResponderMove={onTouchMove}
        onResponderRelease={onTouchEnd}
        onResponderTerminate={onTouchCancel}
        testID="ground"
      >
        {bed && (
          <View
            pointerEvents="none"
            accessible
            accessibilityLabel="Garden bed"
            accessibilityHint="Double tap to plant a seed. The actions plant a low, a middle or a high note."
            accessibilityActions={BED_ACTIONS}
            onAccessibilityAction={onBedAction}
            style={[styles.bed, { left: bed.left, top: bed.top, width: bed.right - bed.left, height: bed.bottom - bed.top }]}
          />
        )}
        {[...seeds, ...leaving].map((seed, index) => (
          <Plant
            key={seed.id}
            seed={seed}
            resting={!playing}
            leaving={index >= count}
            still={still}
            onRing={pulse}
            onPull={remove}
            onGone={dropLeaving}
          />
        ))}
        <HoldRing at={holdAt} progress={holdProgress} />
      </View>

      <Header count={count} playing={playing} top={insets.top} nudge={nudge} onLayout={onHeaderLayout} />
      <Controls
        playing={playing}
        empty={count === 0}
        canScatter={count < MAX_SEEDS && !scattering}
        canUndo={canUndo}
        bottom={insets.bottom}
        onToggle={toggle}
        onClear={clear}
        onUndo={restore}
        onScatter={scatterSeeds}
        onLayout={onControlsLayout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAPER },
  ground: { ...FILL, overflow: 'hidden' },
  bed: { position: 'absolute' },
});
