import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  BottleForm,
  emptyBottleForm,
  parseOptionalNumber,
  type BottleFormHandle,
  type BottleFormValues,
} from '../../src/components/BottleForm';
import { Button } from '../../src/components/Button';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Screen } from '../../src/components/ui';
import { useAddBottle } from '../../src/data/bottles';
import { useClassifyBottle } from '../../src/data/classify';
import type { BottleKind } from '../../src/types/database';

/**
 * Adding a bottle by hand, and the landing point after a barcode scan — the
 * scanner routes here with whatever it managed to resolve as query params, so
 * there is one form and one save path regardless of how the bottle arrived.
 */
export default function NewBottleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    name?: string;
    brand?: string;
    abv?: string;
    volumeMl?: string;
    ingredientId?: string;
    productId?: string;
    imageUrl?: string;
    kind?: string;
  }>();

  const [values, setValues] = useState<BottleFormValues>(() => ({
    ...emptyBottleForm(),
    name: params.name ?? '',
    brand: params.brand ?? '',
    abv: params.abv ?? '',
    volumeMl: params.volumeMl ?? '',
    ingredientId: params.ingredientId ?? null,
    productId: params.productId ?? null,
    imageUrl: params.imageUrl ?? null,
    kind: params.kind === 'staple' ? ('staple' as BottleKind) : ('bottle' as BottleKind),
  }));

  const addBottle = useAddBottle();
  const classify = useClassifyBottle();
  const formRef = useRef<BottleFormHandle>(null);

  // The id the classifier filled in, so the form can flag it as a guess. Cleared
  // the moment the field no longer holds that exact value — a user's own pick,
  // or their clearing of ours, is not a guess any more.
  const [guessedId, setGuessedId] = useState<string | null>(null);

  // Inputs already sent to the classifier. Stops the same name being asked about
  // twice — including right after the user clears a guess they disagreed with,
  // which must not be answered by immediately guessing again.
  const attemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const name = values.name.trim();
    // Too short to mean anything, already set (by hand, barcode, or us), or
    // asked before — in every case the classifier has nothing to add.
    if (name.length < 3 || values.ingredientId) return;

    const brand = values.brand.trim();
    const key = `${name.toLowerCase()}|${brand.toLowerCase()}`;
    if (attemptedRef.current.has(key)) return;

    // Wait for the typing to settle; one lookup per finished label beats one
    // per keystroke.
    const timer = setTimeout(() => {
      attemptedRef.current.add(key);
      classify.mutate(
        { name, brand: brand || null },
        {
          onSuccess: (result) => {
            if (!result.ingredient_id) return;
            setValues((current) => {
              // The answer is stale if they picked something or kept typing
              // while it was in flight.
              if (current.ingredientId || current.name.trim() !== name) return current;
              return { ...current, ingredientId: result.ingredient_id };
            });
            // Safe even when the update above was a no-op: the "guessed" hint
            // only shows while the field actually holds this id.
            setGuessedId(result.ingredient_id);
          },
          // A failed guess is indistinguishable from no guess; stay quiet.
          onError: () => {},
        },
      );
    }, 900);
    return () => clearTimeout(timer);
    // `classify` is a fresh object every render; keying the effect on it would
    // re-arm the timer constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.name, values.brand, values.ingredientId]);

  function handleSubmit() {
    addBottle.mutate(
      {
        name: values.name.trim(),
        brand: values.brand.trim() || null,
        ingredient_id: values.ingredientId,
        product_id: values.productId,
        image_url: values.imageUrl,
        kind: values.kind,
        abv: parseOptionalNumber(values.abv),
        volume_ml: parseOptionalNumber(values.volumeMl),
        fill_pct: values.fillPct,
        status: values.status,
        notes: values.notes.trim() || null,
      },
      {
        onSuccess: () => {
          // Back to wherever the bottle came from — the Bar, or the scanner.
          if (router.canGoBack()) router.back();
          else router.replace('/');
        },
      },
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Add a bottle"
        subtitle={params.productId ? 'Found from the barcode — check the details' : undefined}
        action={
          // Up here so it's reachable without scrolling past the whole form.
          <Button
            label="Add to my bar"
            size="sm"
            onPress={() => formRef.current?.submit()}
            loading={addBottle.isPending}
          />
        }
      />
      <BottleForm
        ref={formRef}
        values={values}
        onChange={setValues}
        ingredientGuessed={values.ingredientId !== null && values.ingredientId === guessedId}
        onSubmit={handleSubmit}
        error={addBottle.error instanceof Error ? addBottle.error.message : null}
      />
    </Screen>
  );
}
