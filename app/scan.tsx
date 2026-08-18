import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { Button } from '../src/components/Button';
import { Chip } from '../src/components/Chip';
import { Body, Heading, Muted, Screen } from '../src/components/ui';
import { lookupBarcode } from '../src/data/products';
import { setPendingCapture, type ShelfCapture } from '../src/data/shelfCapture';
import type { ShelfMimeType } from '../src/data/identify';
import { ThemeScope, useTheme, useThemedStyles } from '../src/providers/theme';
import { radius, spacing, type Theme } from '../src/theme';

/** Barcode symbologies actually printed on bottles. */
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

/**
 * Ignore repeat reads of the same code for this long. The camera fires many
 * times a second on a held barcode, and without this every scan would stack up
 * a navigation.
 */
const RESCAN_COOLDOWN_MS = 3000;

/**
 * JPEG quality for shelf photos. The labels stay legible at this level and the
 * base64 payload sent to the recognition function stays around a megabyte;
 * anything higher is bandwidth for detail the model does not need.
 */
const SHELF_PHOTO_QUALITY = 0.5;

/**
 * Two ways in through the same camera: one bottle by its barcode, or a whole
 * shelf by its labels. The photo goes to the review screen rather than being
 * added straight away — the model's reading is a prefill, never the truth.
 */
type Mode = 'barcode' | 'shelf';

type Status =
  | { kind: 'scanning' }
  | { kind: 'looking-up'; barcode: string }
  | { kind: 'miss'; barcode: string }
  | { kind: 'error'; message: string };

const SHELF_MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

function asShelfMimeType(value: string | undefined): ShelfMimeType {
  return value && SHELF_MIME_TYPES.includes(value) ? (value as ShelfMimeType) : 'image/jpeg';
}

/**
 * The scanner is always the dark room: its chrome floats over a black camera
 * feed, so it is pinned to the dark palette even when the app is in light mode.
 */
export default function ScanScreen() {
  return (
    <ThemeScope scheme="dark">
      <StatusBar style="light" />
      <Scanner />
    </ThemeScope>
  );
}

function Scanner() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('barcode');
  const [status, setStatus] = useState<Status>({ kind: 'scanning' });
  const [active, setActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [shelfError, setShelfError] = useState<string | null>(null);

  const camera = useRef<CameraView>(null);

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
      setCapturing(false);
      setShelfError(null);
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

  /** Stash the photo for the review screen and go there. */
  const submitCapture = useCallback(
    (capture: ShelfCapture) => {
      setPendingCapture(capture);
      router.push('/bottle/review');
    },
    [router],
  );

  const handleShutter = useCallback(async () => {
    if (busy.current || !camera.current) return;
    busy.current = true;
    setCapturing(true);
    setShelfError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await camera.current.takePictureAsync({
        quality: SHELF_PHOTO_QUALITY,
        base64: true,
      });
      if (!photo?.base64) throw new Error('The camera returned no picture.');
      submitCapture({ uri: photo.uri, base64: photo.base64, mimeType: 'image/jpeg' });
    } catch (cause) {
      setShelfError(cause instanceof Error ? cause.message : 'Could not take the photo.');
    } finally {
      busy.current = false;
      setCapturing(false);
    }
  }, [submitCapture]);

  const handleLibrary = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setShelfError(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        base64: true,
        quality: SHELF_PHOTO_QUALITY,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.base64) throw new Error('Could not read that photo.');
      submitCapture({
        uri: asset.uri,
        base64: asset.base64,
        // The picker re-encodes to JPEG whenever it applies `quality`; the mime
        // type is only ever something else when it hands the file back as-is.
        mimeType: asShelfMimeType(asset.mimeType),
      });
    } catch (cause) {
      setShelfError(cause instanceof Error ? cause.message : 'Could not open your photos.');
    } finally {
      busy.current = false;
    }
  }, [submitCapture]);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setStatus({ kind: 'scanning' });
    setShelfError(null);
    busy.current = false;
    lastScan.current = null;
  }, []);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <Screen>
        <View style={styles.permission}>
          <MaterialCommunityIcons name="barcode-scan" size={48} color={colors.accent} />
          <Heading style={styles.centered}>Scan a bottle</Heading>
          <Muted style={styles.centered}>
            Flanagan needs the camera to read barcodes and photograph your shelf. Barcodes never
            leave your phone; a shelf photo is sent once to read the labels and is not kept.
          </Muted>
          <Button label="Allow camera" onPress={() => void requestPermission()} />
          <Button
            label="Choose a shelf photo instead"
            variant="secondary"
            onPress={() => void handleLibrary()}
          />
          {shelfError ? (
            <Body style={[styles.centered, { color: colors.danger }]}>{shelfError}</Body>
          ) : null}
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
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={
            mode === 'barcode' ? { barcodeTypes: [...BARCODE_TYPES] } : undefined
          }
          onBarcodeScanned={mode === 'barcode' && status.kind === 'scanning' ? handleScan : undefined}
        />
      ) : null}

      <View style={styles.overlay} pointerEvents="box-none">
        {mode === 'barcode' ? <View style={styles.reticle} /> : <View style={styles.frame} />}

        <View style={styles.panel}>
          {mode === 'shelf' ? (
            <View style={styles.panelBlock}>
              <Body style={styles.centered}>
                Line up the shelf so the labels are readable, then take the photo. You check
                every bottle before it is added.
              </Body>
              {shelfError ? (
                <Body style={[styles.centered, { color: colors.danger }]}>{shelfError}</Body>
              ) : null}
              <View style={styles.shelfActions}>
                <Pressable
                  onPress={() => void handleLibrary()}
                  disabled={capturing}
                  style={styles.libraryButton}
                  accessibilityRole="button"
                  accessibilityLabel="Choose a photo from your library"
                >
                  <MaterialCommunityIcons name="image-multiple-outline" size={22} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => void handleShutter()}
                  disabled={capturing}
                  style={[styles.shutter, capturing && styles.shutterBusy]}
                  accessibilityRole="button"
                  accessibilityLabel="Take a photo of the shelf"
                  accessibilityState={{ disabled: capturing, busy: capturing }}
                >
                  <View style={styles.shutterInner} />
                </Pressable>
                {/* Mirrors the library button so the shutter sits centred. */}
                <View style={styles.libraryButtonSpacer} />
              </View>
            </View>
          ) : null}

          {mode === 'barcode' && status.kind === 'scanning' ? (
            <Body style={styles.centered}>Point the camera at the barcode.</Body>
          ) : null}

          {mode === 'barcode' && status.kind === 'looking-up' ? (
            <Body style={styles.centered}>Looking up {status.barcode}…</Body>
          ) : null}

          {mode === 'barcode' && status.kind === 'miss' ? (
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

          {mode === 'barcode' && status.kind === 'error' ? (
            <View style={styles.panelBlock}>
              <Body style={[styles.centered, { color: colors.danger }]}>{status.message}</Body>
              <Button
                label="Try again"
                variant="secondary"
                onPress={() => setStatus({ kind: 'scanning' })}
              />
            </View>
          ) : null}
        </View>
      </View>

      <Pressable
        style={styles.close}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        accessibilityRole="button"
        accessibilityLabel="Close the scanner"
      >
        <MaterialCommunityIcons name="close" size={20} color={colors.text} />
      </Pressable>

      <View style={styles.modes} pointerEvents="box-none">
        <Chip label="Barcode" active={mode === 'barcode'} onPress={() => switchMode('barcode')} />
        <Chip label="Shelf" active={mode === 'shelf'} onPress={() => switchMode('shelf')} />
      </View>

      <Pressable
        style={styles.manual}
        onPress={() => router.push('/bottle/new')}
        accessibilityRole="button"
        accessibilityLabel="Add a bottle by hand"
      >
        <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
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
    // The viewfinder echoes the coaster monogram: a thin copper line, no bulk.
    reticle: {
      width: '80%',
      aspectRatio: 1.9,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: radius.xl,
    },
    // Wider and taller than the barcode reticle: a shelf is landscape, and the
    // frame is a hint of what the model will see, not a crop.
    frame: {
      width: '92%',
      aspectRatio: 1.25,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: radius.xl,
      opacity: 0.7,
    },
    panel: {
      backgroundColor: colors.scrim,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
      alignSelf: 'stretch',
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
    close: {
      position: 'absolute',
      top: spacing.xxl + spacing.lg,
      left: spacing.gutter,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.scrim,
    },
    modes: {
      position: 'absolute',
      top: spacing.xxl + spacing.lg,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.xxl + spacing.gutter + 40,
    },
    manual: {
      position: 'absolute',
      top: spacing.xxl + spacing.lg,
      right: spacing.gutter,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.scrim,
    },
    shelfActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.sm,
    },
    shutter: {
      width: 68,
      height: 68,
      borderRadius: 34,
      borderWidth: 3,
      borderColor: colors.cream,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterBusy: {
      opacity: 0.4,
    },
    shutterInner: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.cream,
    },
    libraryButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
    },
    libraryButtonSpacer: {
      width: 44,
      height: 44,
    },
  });
