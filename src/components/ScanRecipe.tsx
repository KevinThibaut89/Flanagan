import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';

import { BottomSheet } from './BottomSheet';
import { ConfirmSheet } from './ConfirmSheet';
import { ShakerLoader } from './ShakerLoader';
import { SheetOption } from './SheetOption';
import { Body, Flourish, Muted, PressableScale } from './ui';
import type { ShelfMimeType } from '../data/identify';
import { useReadRecipe, type ReadRecipe } from '../data/readRecipe';
import { pickRecipePhoto, type PhotoSource } from '../data/recipePhotos';
import { shrinkForModel } from '../lib/images';
import { useTheme, useThemedStyles } from '../providers/theme';
import { radius, spacing, typography, type Theme } from '../theme';

/**
 * JPEG quality for a photographed page. Print is high-contrast and survives
 * compression well; what the model needs is the full sensor resolution, which
 * `quality` leaves alone. Slightly above the shelf photo's setting because
 * small type is less forgiving than a bottle label.
 */
const PAGE_PHOTO_QUALITY = 0.6;

const MIME_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

function asMimeType(value: string): ShelfMimeType {
  return MIME_TYPES.includes(value) ? (value as ShelfMimeType) : 'image/jpeg';
}

type Status =
  | { kind: 'idle' }
  | { kind: 'reading'; uri: string }
  | { kind: 'error'; uri: string | null; message: string }
  /** The page held several recipes; the user picks one. */
  | { kind: 'choosing'; uri: string; recipes: ReadRecipe[] }
  | { kind: 'done'; uri: string; recipe: ReadRecipe };

/**
 * The way into the recipe editor that starts from a photograph — a page of a
 * book, a menu, a screenshot — instead of a blank form.
 *
 * The photo goes to `read-recipe`, and what comes back is poured into the
 * editor's fields for the user to check: the editor is the review step, so
 * nothing here writes to the database. Sits at the top of the form as an
 * invitation while the form is empty, and turns into a small receipt (the
 * thumbnail, a reminder to check the lines) once a recipe has been read.
 */
export function ScanRecipe({
  onRead,
  hasContent,
}: {
  /** Receives the recipe to prefill the form with. */
  onRead: (recipe: ReadRecipe) => void;
  /** Whether the form already holds something a scan would replace. */
  hasContent: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const read = useReadRecipe();

  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [sourceOpen, setSourceOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Native UI cannot be presented over a modal that is still animating out
  // (see `useModalDidClose`), so each sheet only records what should happen
  // next and its `onDidClose` carries it out: confirm → source sheet, and
  // source sheet → camera or library.
  const openSourceAfterConfirm = useRef(false);
  const pendingSource = useRef<PhotoSource | null>(null);

  function start() {
    // A form with typing in it deserves a warning before it is replaced; the
    // second scan after a first one does not — that content came from a scan.
    if (hasContent && status.kind !== 'done') setConfirmOpen(true);
    else setSourceOpen(true);
  }

  function finish(recipe: ReadRecipe, uri: string) {
    setStatus({ kind: 'done', uri, recipe });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onRead(recipe);
  }

  function choose(source: PhotoSource) {
    pendingSource.current = source;
    setSourceOpen(false);
  }

  function handleSourceClosed() {
    const source = pendingSource.current;
    pendingSource.current = null;
    if (source) void pick(source);
  }

  async function pick(source: PhotoSource) {
    let uri: string | null = null;
    try {
      const picked = await pickRecipePhoto(source, { quality: PAGE_PHOTO_QUALITY });
      if (!picked) return;
      uri = picked.uri;
      setStatus({ kind: 'reading', uri });

      const shrunk = await shrinkForModel(picked.uri, picked.size);
      const result = await read.mutateAsync({
        base64: shrunk.base64,
        mimeType: asMimeType(shrunk.mimeType),
      });

      if (result.recipes.length === 0) {
        setStatus({
          kind: 'error',
          uri,
          message:
            result.message ??
            "Couldn't find a recipe in that photo — try a flatter shot, with the whole recipe in frame.",
        });
      } else if (result.recipes.length === 1) {
        finish(result.recipes[0], uri);
      } else {
        setStatus({ kind: 'choosing', uri, recipes: result.recipes });
      }
    } catch (cause) {
      setStatus({
        kind: 'error',
        uri,
        message: cause instanceof Error ? cause.message : 'Could not read that photo.',
      });
    }
  }

  const thumbUri = status.kind === 'idle' ? null : status.uri;

  return (
    <View style={styles.wrapper}>
      {status.kind === 'reading' ? (
        <View style={[styles.card, styles.cardActive]}>
          <Thumb uri={status.uri} />
          <View style={styles.text}>
            <Body style={styles.title}>Reading the recipe…</Body>
            <Muted style={styles.detail}>Quantities, steps and all. A few seconds.</Muted>
          </View>
          <ShakerLoader color={colors.accent} size={22} />
        </View>
      ) : status.kind === 'done' ? (
        <View style={[styles.card, styles.cardDone]}>
          <Thumb uri={status.uri} />
          <View style={styles.text}>
            <Body style={styles.title}>Read from your photo</Body>
            <Muted style={styles.detail}>
              {status.recipe.confidence === 'low'
                ? 'The page was hard to read — check every line before saving.'
                : 'Check each line before saving; scanning is a first draft.'}
            </Muted>
          </View>
          <PressableScale
            onPress={start}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Scan a different photo"
            style={styles.again}
          >
            <MaterialCommunityIcons name="camera-retake-outline" size={20} color={colors.textMuted} />
          </PressableScale>
        </View>
      ) : (
        <PressableScale
          scaleTo={0.99}
          onPress={start}
          accessibilityRole="button"
          accessibilityLabel="Scan a recipe from a photo"
          style={[styles.card, styles.cardInvite]}
        >
          {thumbUri ? (
            <Thumb uri={thumbUri} />
          ) : (
            <View style={styles.iconWell}>
              <MaterialCommunityIcons name="text-recognition" size={22} color={colors.accent} />
            </View>
          )}
          <View style={styles.text}>
            <Body style={styles.title}>Scan a recipe</Body>
            <Flourish style={styles.invite}>
              Photograph a book page, a menu or a screen — it fills the form in for you.
            </Flourish>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textFaint} />
        </PressableScale>
      )}

      {status.kind === 'error' ? <Text style={styles.error}>{status.message}</Text> : null}

      <BottomSheet
        visible={sourceOpen}
        onClose={() => setSourceOpen(false)}
        onDidClose={handleSourceClosed}
        title="Scan a recipe"
      >
        <View style={styles.options}>
          <SheetOption
            icon="camera-outline"
            label="Take a photo"
            detail="A book, a menu, a card"
            onPress={() => choose('camera')}
          />
          <SheetOption
            icon="image-multiple-outline"
            label="Choose from library"
            detail="A screenshot or a saved picture"
            onPress={() => choose('library')}
          />
        </View>
        <Muted style={styles.privacy}>
          The photo is sent once to read the recipe and is not kept. Every field stays editable.
        </Muted>
      </BottomSheet>

      <BottomSheet
        visible={status.kind === 'choosing'}
        onClose={() => setStatus({ kind: 'idle' })}
        title="Which recipe?"
      >
        {status.kind === 'choosing' ? (
          <View style={styles.options}>
            <Muted style={styles.chooseHint}>
              That page has {status.recipes.length} recipes. Pick the one to write down — you can
              scan the page again for the others.
            </Muted>
            {status.recipes.map((recipe, i) => (
              <SheetOption
                key={`${i}-${recipe.title}`}
                icon="glass-cocktail"
                label={recipe.title}
                detail={describe(recipe)}
                onPress={() => finish(recipe, status.uri)}
              />
            ))}
          </View>
        ) : null}
      </BottomSheet>

      <ConfirmSheet
        visible={confirmOpen}
        title="Start over from a photo?"
        message="What you’ve typed so far will be replaced by what the scan reads."
        confirmLabel="Scan"
        onConfirm={() => {
          openSourceAfterConfirm.current = true;
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
        onDidClose={() => {
          if (!openSourceAfterConfirm.current) return;
          openSourceAfterConfirm.current = false;
          setSourceOpen(true);
        }}
      />
    </View>
  );
}

function describe(recipe: ReadRecipe): string {
  const count = recipe.ingredients.filter((line) => !line.is_garnish).length;
  const parts = [
    `${count} ingredient${count === 1 ? '' : 's'}`,
    recipe.confidence === 'low' ? 'hard to read' : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

function Thumb({ uri }: { uri: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Image source={{ uri }} style={styles.thumb} contentFit="cover" accessibilityIgnoresInvertColors />
  );
}

const makeStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
    },
    cardInvite: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
    },
    cardActive: {
      backgroundColor: colors.surface,
    },
    cardDone: {
      backgroundColor: colors.surface,
    },
    iconWell: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    thumb: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceRaised,
    },
    text: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontWeight: '600',
    },
    invite: {
      fontSize: 14,
      lineHeight: 19,
      color: colors.textMuted,
    },
    detail: {
      fontSize: 13,
      lineHeight: 18,
    },
    again: {
      padding: spacing.xs,
    },
    error: {
      ...typography.small,
      color: colors.danger,
    },
    options: {
      gap: spacing.xs,
    },
    privacy: {
      fontSize: 12,
      lineHeight: 17,
    },
    chooseHint: {
      lineHeight: 18,
      paddingBottom: spacing.sm,
    },
  });
