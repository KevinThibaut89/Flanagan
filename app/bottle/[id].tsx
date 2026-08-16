import { useEffect, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import {
  BottleForm,
  emptyBottleForm,
  parseOptionalNumber,
  type BottleFormValues,
} from '../../src/components/BottleForm';
import { Button } from '../../src/components/Button';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ErrorState, Loading, Screen } from '../../src/components/ui';
import { useBottle, useDeleteBottle, useUpdateBottle } from '../../src/data/bottles';
import { colors } from '../../src/theme';

export default function BottleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: bottle, isLoading, error, refetch } = useBottle(id);
  const updateBottle = useUpdateBottle();
  const deleteBottle = useDeleteBottle();

  const [values, setValues] = useState<BottleFormValues>(emptyBottleForm);
  const [loaded, setLoaded] = useState(false);

  // Seed the form once. Re-seeding on every fetch would stomp on edits in
  // progress whenever the query refetched in the background.
  useEffect(() => {
    if (!bottle || loaded) return;
    setValues({
      name: bottle.name,
      brand: bottle.brand ?? '',
      ingredientId: bottle.ingredient_id,
      abv: bottle.abv !== null ? String(bottle.abv) : '',
      volumeMl: bottle.volume_ml !== null ? String(bottle.volume_ml) : '',
      fillPct: bottle.fill_pct,
      status: bottle.status,
      notes: bottle.notes ?? '',
      kind: bottle.kind,
      productId: bottle.product_id,
      imageUrl: bottle.image_url,
    });
    setLoaded(true);
  }, [bottle, loaded]);

  function handleSave() {
    updateBottle.mutate(
      {
        id,
        name: values.name.trim(),
        brand: values.brand.trim() || null,
        ingredient_id: values.ingredientId,
        abv: parseOptionalNumber(values.abv),
        volume_ml: parseOptionalNumber(values.volumeMl),
        fill_pct: values.fillPct,
        status: values.status,
        notes: values.notes.trim() || null,
      },
      {
        onSuccess: () => {
          if (router.canGoBack()) router.back();
          else router.replace('/');
        },
      },
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Remove this bottle?',
      'It disappears from your bar and from what you can make. This cannot be undone — if you have just finished it, set the status to Finished instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            deleteBottle.mutate(id, {
              onSuccess: () => {
                if (router.canGoBack()) router.back();
                else router.replace('/');
              },
            }),
        },
      ],
    );
  }

  if (isLoading) return <Loading />;
  if (error || !bottle) {
    return (
      <Screen>
        <ScreenHeader title="Bottle" />
        <ErrorState
          error={error ?? new Error('That bottle no longer exists.')}
          action={<Button label="Try again" onPress={() => refetch()} />}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title={bottle.name}
        subtitle={bottle.kind === 'staple' ? 'Staple' : bottle.brand}
        action={
          <Pressable onPress={confirmDelete} hitSlop={10} accessibilityLabel="Remove bottle">
            <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.danger} />
          </Pressable>
        }
      />
      <BottleForm
        values={values}
        onChange={setValues}
        onSubmit={handleSave}
        submitLabel="Save changes"
        busy={updateBottle.isPending}
        error={updateBottle.error instanceof Error ? updateBottle.error.message : null}
        footer={
          bottle.status === 'in_stock' ? (
            <Button
              label="Mark as finished"
              variant="secondary"
              onPress={() => setValues({ ...values, status: 'finished', fillPct: 0 })}
            />
          ) : null
        }
      />
    </Screen>
  );
}
