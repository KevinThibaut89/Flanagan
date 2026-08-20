import { useEffect, useState } from 'react';

/**
 * The value as it was `delayMs` ago, once it has stopped changing. Used where
 * each change would otherwise be a network call — the library search embeds
 * every query it is sent, so it should see words, not keystrokes.
 */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
