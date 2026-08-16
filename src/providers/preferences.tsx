import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '../lib/supabase';
import type { UnitPreference } from '../types/database';
import { useAuth } from './auth';

interface PreferencesValue {
  units: UnitPreference;
  displayName: string | null;
  setUnits: (units: UnitPreference) => void;
  isUpdating: boolean;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, unit_preference')
        .eq('id', userId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (units: UnitPreference) => {
      const { error } = await supabase
        .from('profiles')
        .update({ unit_preference: units })
        .eq('id', userId!);
      if (error) throw error;
      return units;
    },
    // The toggle should flip the instant it is tapped; a failed write rolls back.
    onMutate: async (units) => {
      await queryClient.cancelQueries({ queryKey: ['profile', userId] });
      const previous = queryClient.getQueryData(['profile', userId]);
      queryClient.setQueryData(['profile', userId], (old: typeof profile) =>
        old ? { ...old, unit_preference: units } : old,
      );
      return { previous };
    },
    onError: (_error, _units, context) => {
      if (context?.previous) queryClient.setQueryData(['profile', userId], context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });

  const value = useMemo<PreferencesValue>(
    () => ({
      units: profile?.unit_preference ?? 'metric',
      displayName: profile?.display_name ?? null,
      setUnits: (units) => mutation.mutate(units),
      isUpdating: mutation.isPending,
    }),
    [profile, mutation],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return value;
}

/** Shorthand for the common case of only needing the unit system. */
export function useUnits(): UnitPreference {
  return usePreferences().units;
}
