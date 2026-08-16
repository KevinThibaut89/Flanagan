import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  BottleForm,
  emptyBottleForm,
  parseOptionalNumber,
  type BottleFormValues,
} from '../../src/components/BottleForm';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { Screen } from '../../src/components/ui';
import { useAddBottle } from '../../src/data/bottles';
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
      />
      <BottleForm
        values={values}
        onChange={setValues}
        onSubmit={handleSubmit}
        submitLabel="Add to my bar"
        busy={addBottle.isPending}
        error={addBottle.error instanceof Error ? addBottle.error.message : null}
      />
    </Screen>
  );
}
