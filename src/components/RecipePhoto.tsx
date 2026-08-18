import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';

import { BottomSheet } from './BottomSheet';
import { ShakerLoader } from './ShakerLoader';
import { SheetOption } from './SheetOption';
import { Flourish, PressableScale } from './ui';
import {
  pickRecipePhoto,
  useRemoveRecipePhoto,
  useSetRecipePhoto,
  type PhotoSource,
} from '../data/recipePhotos';
import { useTheme, useThemedStyles } from '../providers/theme';
import { darkColors, radius, spacing, typography, type Theme } from '../theme';

/**
 * The picture of the finished drink on a recipe page. With a photo it is the
 * hero of the page; without one it is a quiet invitation to add one. Either
 * way a tap opens the same sheet — camera, library, and (when there is
 * something to remove) remove.
 */
export function RecipePhoto({ recipeId, imageUrl }: { recipeId: string; imageUrl: string | null }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const setPhoto = useSetRecipePhoto();
  const removePhoto = useRemoveRecipePhoto();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The picked file shows immediately while it uploads, so the page reacts to
  // the tap rather than to the network.
  const [pendingUri, setPendingUri] = useState<string | null>(null);

  const busy = setPhoto.isPending || removePhoto.isPending;

  // The picker cannot be presented while the sheet is still sliding away (see
  // `useModalDidClose`), so a tap only records the choice; the sheet's
  // `onDidClose` is what actually opens the camera or the library.
  const pendingSource = useRef<PhotoSource | null>(null);

  function choose(source: PhotoSource) {
    pendingSource.current = source;
    setSheetOpen(false);
  }

  function handleSheetClosed() {
    const source = pendingSource.current;
    pendingSource.current = null;
    if (source) void pick(source);
  }

  async function pick(source: PhotoSource) {
    setError(null);
    try {
      const picked = await pickRecipePhoto(source);
      if (!picked) return;
      setPendingUri(picked.uri);
      await setPhoto.mutateAsync({ recipeId, photo: picked, previousUrl: imageUrl });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save that photo.');
    } finally {
      setPendingUri(null);
    }
  }

  async function remove() {
    if (!imageUrl) return;
    setSheetOpen(false);
    setError(null);
    try {
      await removePhoto.mutateAsync({ recipeId, url: imageUrl });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove that photo.');
    }
  }

  const shownUri = pendingUri ?? imageUrl;

  return (
    <View style={styles.wrapper}>
      {shownUri ? (
        <PressableScale
          scaleTo={0.99}
          onPress={() => setSheetOpen(true)}
          disabled={busy}
          accessibilityRole="imagebutton"
          accessibilityLabel="Recipe photo — tap to change"
          style={styles.hero}
        >
          <Image
            source={{ uri: shownUri }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
          {busy ? (
            <View style={styles.veil}>
              <ShakerLoader color={darkColors.text} size={26} />
            </View>
          ) : (
            <View style={styles.badge}>
              <MaterialCommunityIcons name="camera-outline" size={14} color={darkColors.text} />
              <Text style={styles.badgeText}>Change</Text>
            </View>
          )}
        </PressableScale>
      ) : (
        <PressableScale
          onPress={() => setSheetOpen(true)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Add a photo"
          style={styles.empty}
        >
          {busy ? (
            <ShakerLoader color={colors.textMuted} size={22} />
          ) : (
            <MaterialCommunityIcons name="camera-plus-outline" size={22} color={colors.textMuted} />
          )}
          <Flourish style={styles.emptyText}>
            {busy ? 'Saving your photo…' : 'Add a photo of your pour'}
          </Flourish>
        </PressableScale>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onDidClose={handleSheetClosed}
        title={imageUrl ? 'Change photo' : 'Add a photo'}
      >
        <View style={styles.options}>
          <SheetOption icon="camera-outline" label="Take a photo" onPress={() => choose('camera')} />
          <SheetOption
            icon="image-multiple-outline"
            label="Choose from library"
            onPress={() => choose('library')}
          />
          {imageUrl ? (
            <SheetOption
              icon="trash-can-outline"
              label="Remove photo"
              destructive
              onPress={() => void remove()}
            />
          ) : null}
        </View>
      </BottomSheet>
    </View>
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.sm,
    },
    hero: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    image: {
      width: '100%',
      aspectRatio: 4 / 3,
    },
    // Overlays sit on a photo, not on the theme, so they are always dark
    // glass with light type whichever scheme is active.
    veil: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: darkColors.scrim,
    },
    badge: {
      position: 'absolute',
      right: spacing.md,
      bottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(8, 6, 4, 0.6)',
    },
    badgeText: {
      ...typography.small,
      fontWeight: '600',
      color: darkColors.text,
    },
    empty: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
    },
    emptyText: {
      color: colors.textMuted,
    },
    error: {
      ...typography.small,
      color: colors.danger,
    },
    options: {
      gap: spacing.xs,
    },
  });
