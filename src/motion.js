import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/** Animations run on the native driver everywhere it exists. */
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Phones can tap back; a browser cannot. */
export const HAPTICS = Platform.OS !== 'web';

/** An animated value that is made once and kept for the life of the component. */
export function useValue(initial = 0) {
  return useState(() => new Animated.Value(initial))[0];
}

/**
 * True while the person has asked for less motion: Reduce Motion on iPhone,
 * Remove animations on Android, or the same preference in a browser.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(!!value);
      })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => setReduced(!!value));
    return () => {
      mounted = false;
      if (listener) listener.remove();
    };
  }, []);
  return reduced;
}

/** Says something through VoiceOver or TalkBack, when one of them is on. */
export function announce(message) {
  AccessibilityInfo.announceForAccessibility(message);
}

const quietly = (tap) => {
  if (HAPTICS) tap().catch(() => {});
};

/** The small taps a phone gives back. */
export const haptic = {
  /** A plant was touched or planted. */
  tick: () => quietly(() => Haptics.selectionAsync()),
  /** A handful of seeds was thrown. */
  light: () => quietly(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Something was taken away, or could not be done. */
  warning: () => quietly(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};
