import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';

import { Button } from '../../src/components/Button';
import { Icon } from '../../src/components/Icon';
import { Body, Heading, Muted, Screen } from '../../src/components/ui';
import { lookupBarcode } from '../../src/data/products';
import { colors, radius, spacing } from '../../src/theme';

/** Barcode symbologies actually printed on bottles. */
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

/**
 * Ignore repeat reads of the same code for this long. The camera fires many
 * times a second on a held barcode, and without this every scan would stack up
 * a navigation.
 */
const RESCAN_COOLDOWN_MS = 3000;

type Status =
  | { kind: 'scanning' }
  | { kind: 'looking-up'; barcode: string }
  | { kind: 'miss'; barcode: string }
  | { kind: 'error'; message: string };

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<Status>({ kind: 'scanning' });
  const [active, setActive] = useState(false);

  // Refs, not state: the scanner callback fires far faster than React can
  // re-render, so guarding on state would let duplicates through.
  const lastScan = useRef<{ barcode: string; at: number } | null>(null);
  const busy = useRef(false);

  // Only run the camera while this tab is on screen. Leaving it mounted in the
  // background keeps the sensor hot and drains the battery.
  useFocusEffect(
    useCallback(() => {
      setActive(true);
      setStatus({ kind: 'scanning' });
      busy.current = false;
      lastScan.current = null;
      return () => setActive(false);
    }, []),
  );

  const handleScan = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      const barcode = data.trim();
      const now = Date.now();

      if (busy.current) return;
      if (
        lastScan.current &&
        lastScan.current.barcode === barcode &&
        now - lastScan.current.at < RESCAN_COOLDOWN_MS
      ) {
        return;
      }

      busy.current = true;
      lastScan.current = { barcode, at: now };
      setStatus({ kind: 'looking-up', barcode });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      try {
        const result = await lookupBarcode(barcode);

        if (result.found && result.product) {
          const product = result.product;
          router.push({
            pathname: '/bottle/new',
            params: {
              name: product.name,
              brand: product.brand ?? '',
              abv: product.abv !== null ? String(product.abv) : '',
              volumeMl: product.volume_ml !== null ? String(product.volume_ml) : '',
              ingredientId: product.ingredient_id ?? '',
              productId: product.id ?? '',
              imageUrl: product.image_url ?? '',
            },
          });
          setStatus({ kind: 'scanning' });
        } else {
          setStatus({ kind: 'miss', barcode });
        }
      } catch (cause) {
        setStatus({
          kind: 'error',
          message: cause instanceof Error ? cause.message : 'The lookup failed.',
        });
      } finally {
        busy.current = false;
      }
    },
    [router],
  );

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <Screen>
        <View style={styles.permission}>
          <Icon name="scan" size={48} color={colors.accent} />
          <Heading style={styles.centered}>Scan a bottle</Heading>
          <Muted style={styles.centered}>
            Flanagan needs the camera to read barcodes. It only looks at barcodes — nothing is
            recorded or uploaded.
          </Muted>
          <Button label="Allow camera" onPress={() => void requestPermission()} />
          <Button
            label="Add a bottle by hand instead"
            variant="ghost"
            onPress={() => router.push('/bottle/new')}
          />
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.container}>
      {active ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={status.kind === 'scanning' ? handleScan : undefined}
        />
      ) : null}

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.reticle} />

        <BlurView tint="systemChromeMaterialDark" intensity={80} style={styles.panel}>
          {status.kind === 'scanning' ? (
            <Body style={styles.centered}>Point the camera at the barcode.</Body>
          ) : null}

          {status.kind === 'looking-up' ? (
            <Body style={styles.centered}>Looking up {status.barcode}…</Body>
          ) : null}

          {status.kind === 'miss' ? (
            <View style={styles.panelBlock}>
              <Body style={styles.centered}>
                Nothing found for {status.barcode}. Fill it in once and Flanagan will recognise it
                next time.
              </Body>
              <Button
                label="Enter it by hand"
                onPress={() =>
                  router.push({ pathname: '/bottle/new', params: { barcode: status.barcode } })
                }
              />
              <Button
                label="Scan again"
                variant="ghost"
                onPress={() => setStatus({ kind: 'scanning' })}
              />
            </View>
          ) : null}

          {status.kind === 'error' ? (
            <View style={styles.panelBlock}>
              <Body style={[styles.centered, { color: colors.danger }]}>{status.message}</Body>
              <Button
                label="Try again"
                variant="secondary"
                onPress={() => setStatus({ kind: 'scanning' })}
              />
            </View>
          ) : null}
        </BlurView>
      </View>

      <Pressable
        style={styles.manualWrap}
        onPress={() => router.push('/bottle/new')}
        accessibilityRole="button"
        accessibilityLabel="Add a bottle by hand"
      >
        <BlurView tint="systemChromeMaterialDark" intensity={80} style={styles.manual}>
          <Icon name="edit" size={18} color={colors.text} />
          <Body>By hand</Body>
        </BlurView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xxl,
  },
  // iOS camera chrome is white, not tinted.
  reticle: {
    width: '80%',
    aspectRatio: 1.9,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: radius.lg,
  },
  panel: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    padding: spacing.lg,
    gap: spacing.md,
    alignSelf: 'stretch',
    // expo-blur doesn't blur on Android; fall back to the scrim colour.
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.scrim,
  },
  panelBlock: {
    gap: spacing.md,
  },
  centered: {
    textAlign: 'center',
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  manualWrap: {
    position: 'absolute',
    top: spacing.xxl + spacing.lg,
    right: spacing.lg,
  },
  manual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.scrim,
  },
});
