import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

/**
 * A cocktail glass that tilts side to side, as if being swirled — the app's
 * stand-in for ActivityIndicator. Rendered at a fixed height so buttons
 * don't jump when their label is swapped for the loader.
 */
export function ShakerLoader({ color, size = 22 }: { color: string; size?: number }) {
  // 0 → 1 → 0, mapped onto rotation about the base of the glass.
  const tilt = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(tilt, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(tilt, {
          toValue: 0,
          duration: 840,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(tilt, {
          toValue: 0.5,
          duration: 420,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [tilt]);

  const rotate = tilt.interpolate({
    inputRange: [0, 1],
    outputRange: ['-16deg', '16deg'],
  });
  // Rotating around the glass's foot rather than its centre: shift the
  // origin down by half the glyph, rotate, then shift back.
  const half = size / 2;
  const transform = [
    { translateY: half },
    { rotate },
    { translateY: -half },
  ];

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Animated.View style={{ transform }}>
        <MaterialCommunityIcons name="glass-cocktail" size={size} color={color} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
