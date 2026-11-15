import { memo, useImperativeHandle, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { USE_NATIVE_DRIVER } from './motion';
import Ripple, { lookFor } from './Ripple';
import { FILL } from './theme';

/** With more ripples than this in the air, new echoes are heard and felt but not drawn. */
const BUDGET = 16;

let nextId = 1;

/**
 * Every ripple in the air, under the plants. The ripples are this layer's own
 * state, so the rest of the app is not drawn again each time one is born or
 * fades. A ripple is added through the layer's ref: `add(x, y, echo)`.
 */
function RippleLayer({ still, ref }) {
  const [ripples, setRipples] = useState([]);
  const alive = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      add(x, y, echo = false) {
        const look = lookFor(echo, still);
        if (!look || (echo && alive.current > BUDGET)) return;

        const id = nextId++;
        const progress = new Animated.Value(0);
        alive.current += 1;
        setRipples((list) => [...list, { id, x, y, look, progress }]);
        Animated.timing(progress, {
          toValue: 1,
          duration: look.life,
          easing: Easing.linear,
          useNativeDriver: USE_NATIVE_DRIVER,
        }).start(() => {
          alive.current -= 1;
          setRipples((list) => list.filter((ripple) => ripple.id !== id));
        });
      },
    }),
    [still]
  );

  return (
    <View style={styles.layer} pointerEvents="none">
      {ripples.map((ripple) => (
        <Ripple key={ripple.id} ripple={ripple} />
      ))}
    </View>
  );
}

export default memo(RippleLayer);

const styles = StyleSheet.create({
  layer: { ...FILL, overflow: 'hidden' },
});
