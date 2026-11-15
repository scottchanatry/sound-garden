import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';

import {
  ECHO_REACH,
  MAX_SEEDS,
  RIPPLE_REACH,
  RIPPLE_SPEED,
  colorForNote,
  noteForY,
  periodForX,
  reached,
  seedAt,
} from './src/garden';
import { prepareSound, releaseSound, ring } from './src/sound';

const NATIVE = Platform.OS !== 'web';
const HOLD_MS = 550;

let nextId = 1;

export default function App() {
  const [seeds, setSeeds] = useState([]);
  const [ripples, setRipples] = useState([]);
  const [playing, setPlaying] = useState(true);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // The latest values, for timers that fire later.
  const seedsRef = useRef(seeds);
  seedsRef.current = seeds;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const timers = useRef(new Set());
  const bumps = useRef(new Map());

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      releaseSound();
    };
  }, []);

  const bumpFor = useCallback((id) => {
    if (!bumps.current.has(id)) bumps.current.set(id, new Animated.Value(0));
    return bumps.current.get(id);
  }, []);

  const addRipple = useCallback((seed, reach, strength) => {
    const progress = new Animated.Value(0);
    const id = nextId++;
    setRipples((list) => [...list, { id, x: seed.x, y: seed.y, color: colorForNote(seed.note), reach, strength, progress }]);
    Animated.timing(progress, {
      toValue: 1,
      duration: (reach / RIPPLE_SPEED) * 1000,
      easing: Easing.linear,
      useNativeDriver: NATIVE,
    }).start(() => {
      setRipples((list) => list.filter((ripple) => ripple.id !== id));
    });
  }, []);

  // A seed sounds its note and sends out a ripple. A full pulse reaches other
  // seeds, and each one it reaches answers with a quieter echo. Echoes do not
  // spread further, so the garden always settles.
  const pulse = useCallback(
    (id, echo = false) => {
      const seed = seedsRef.current.find((item) => item.id === id);
      if (!seed) return;

      ring(seed.note, echo ? 0.35 : 0.9);
      addRipple(seed, echo ? ECHO_REACH : RIPPLE_REACH, echo ? 0.45 : 0.9);

      const bump = bumpFor(id);
      bump.setValue(1);
      Animated.timing(bump, { toValue: 0, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();

      if (!echo) {
        for (const hit of reached(seed, seedsRef.current)) {
          later(() => pulse(hit.id, true), hit.delay);
        }
      }
    },
    [addRipple, bumpFor, later]
  );

  // Every seed keeps its own slow beat.
  useEffect(() => {
    if (!playing) return undefined;
    const intervals = seeds.map((seed) => setInterval(() => pulse(seed.id), seed.period));
    return () => intervals.forEach(clearInterval);
  }, [seeds, playing, pulse]);

  const plant = useCallback(
    (x, y) => {
      if (seedsRef.current.length >= MAX_SEEDS) return;
      const seed = {
        id: nextId++,
        x,
        y,
        note: noteForY(y, size.height),
        period: periodForX(x, size.width),
      };
      const next = [...seedsRef.current, seed];
      seedsRef.current = next;
      setSeeds(next);
      pulse(seed.id);
    },
    [pulse, size]
  );

  const remove = useCallback((id) => {
    bumps.current.delete(id);
    setSeeds((list) => list.filter((seed) => seed.id !== id));
  }, []);

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    bumps.current.clear();
    setSeeds([]);
  }, []);

  // Touch: tap empty ground to plant, tap a seed to ring it, hold a seed to pull it up.
  const touch = useRef(null);

  const onTouchStart = useCallback(
    (event) => {
      prepareSound();
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      const seed = seedAt(point, seedsRef.current);
      const current = { point, seedId: seed ? seed.id : null, held: false, timer: null };
      if (seed) {
        current.timer = setTimeout(() => {
          current.held = true;
          if (NATIVE) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          remove(seed.id);
        }, HOLD_MS);
      }
      touch.current = current;
    },
    [remove]
  );

  const onTouchEnd = useCallback(() => {
    const current = touch.current;
    touch.current = null;
    if (!current) return;
    if (current.timer) clearTimeout(current.timer);
    if (current.held) return;
    if (NATIVE) Haptics.selectionAsync().catch(() => {});
    if (current.seedId != null) {
      pulse(current.seedId);
    } else {
      plant(current.point.x, current.point.y);
    }
  }, [plant, pulse]);

  const onTouchCancel = useCallback(() => {
    if (touch.current && touch.current.timer) clearTimeout(touch.current.timer);
    touch.current = null;
  }, []);

  const full = seeds.length >= MAX_SEEDS;

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <View
        style={styles.ground}
        onLayout={(event) => setSize(event.nativeEvent.layout)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={onTouchStart}
        onResponderRelease={onTouchEnd}
        onResponderTerminate={onTouchCancel}
        accessibilityLabel="Garden. Tap to plant a seed."
        testID="ground"
      >
        {ripples.map((ripple) => (
          <Animated.View
            key={ripple.id}
            pointerEvents="none"
            style={[
              styles.ripple,
              {
                left: ripple.x - ripple.reach,
                top: ripple.y - ripple.reach,
                width: ripple.reach * 2,
                height: ripple.reach * 2,
                borderRadius: ripple.reach,
                borderColor: ripple.color,
                opacity: ripple.progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [ripple.strength, ripple.strength * 0.35, 0] }),
                transform: [{ scale: ripple.progress.interpolate({ inputRange: [0, 1], outputRange: [0.03, 1] }) }],
              },
            ]}
          />
        ))}

        {seeds.map((seed) => {
          const color = colorForNote(seed.note);
          const bump = bumpFor(seed.id);
          return (
            <Animated.View
              key={seed.id}
              pointerEvents="none"
              testID="seed"
              style={[
                styles.seed,
                {
                  left: seed.x - 9,
                  top: seed.y - 9,
                  backgroundColor: color,
                  shadowColor: color,
                  transform: [{ scale: bump.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
                },
              ]}
            />
          );
        })}

        {seeds.length === 0 && (
          <View style={styles.empty} pointerEvents="none">
            <Text style={styles.emptyTitle}>Tap anywhere to plant a sound.</Text>
            <Text style={styles.emptyText}>Higher is a higher note. Further right is a slower beat.</Text>
          </View>
        )}
      </View>

      <View style={styles.header} pointerEvents="none">
        <Text style={styles.title}>Sound Garden</Text>
        <Text style={styles.hint}>
          {full ? 'The garden is full. Hold a dot to pull it up.' : 'Tap to plant · tap a dot to ring it · hold to remove'}
        </Text>
      </View>

      <View style={styles.footer} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => setPlaying((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause the garden' : 'Let the garden play'}
          testID="toggle"
        >
          <Text style={styles.buttonText}>{playing ? 'Pause' : 'Play'}</Text>
        </Pressable>
        <Text style={styles.count} testID="count">
          {seeds.length} / {MAX_SEEDS}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, seeds.length === 0 && styles.buttonDisabled]}
          onPress={clear}
          disabled={seeds.length === 0}
          accessibilityRole="button"
          accessibilityLabel="Clear the garden"
          testID="clear"
        >
          <Text style={styles.buttonText}>Clear</Text>
        </Pressable>
      </View>
    </View>
  );
}

const NIGHT = '#0B1020';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT },
  ground: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  ripple: { position: 'absolute', borderWidth: 2 },
  seed: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  empty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { color: '#E8ECF8', fontSize: 20, fontWeight: '600', textAlign: 'center', marginBottom: 10 },
  emptyText: { color: '#8D97B5', fontSize: 15, textAlign: 'center', lineHeight: 21 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 58, paddingHorizontal: 20, alignItems: 'center' },
  title: { color: '#E8ECF8', fontSize: 17, fontWeight: '700', letterSpacing: 0.4 },
  hint: { color: '#8D97B5', fontSize: 12.5, marginTop: 5, textAlign: 'center' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 36,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    minWidth: 84,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(232,236,248,0.28)',
    backgroundColor: 'rgba(232,236,248,0.06)',
    alignItems: 'center',
  },
  buttonPressed: { backgroundColor: 'rgba(232,236,248,0.18)' },
  buttonDisabled: { opacity: 0.35 },
  buttonText: { color: '#E8ECF8', fontSize: 15, fontWeight: '600' },
  count: { color: '#8D97B5', fontSize: 13, fontVariant: ['tabular-nums'] },
});
