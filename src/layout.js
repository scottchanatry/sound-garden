import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * In a browser there is no notch or home bar, so the safe areas are zero unless
 * the address asks for a phone's: "?insets=47,34" gives 47 points at the top
 * and 34 at the bottom, which makes a recording look like the app on an iPhone.
 */
function insetsFromAddress() {
  const search = typeof window !== 'undefined' && window.location ? window.location.search : '';
  const match = /[?&]insets=(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/.exec(search || '');
  return { top: match ? Number(match[1]) : 0, bottom: match ? Number(match[2]) : 0 };
}

const WEB_INSETS = Platform.OS === 'web' ? insetsFromAddress() : null;

/** The space taken at the top and bottom of the screen by the status bar, notch, home bar or navigation bar. */
export function useInsets() {
  const insets = useSafeAreaInsets();
  return WEB_INSETS || insets;
}
