import * as SecureStore from 'expo-secure-store';

/**
 * SecureStore rejects values larger than 2048 bytes on Android. A Supabase
 * session (access JWT + refresh token + user object) routinely exceeds that,
 * so values are split across numbered keys.
 *
 * Layout for key `k`:
 *   `k`     → chunk count, as a decimal string
 *   `k.0`…  → the chunks, in order
 */

const CHUNK_SIZE = 1800;

function chunkKey(key: string, index: number) {
  return `${key}.${index}`;
}

async function readChunkCount(key: string): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (raw === null) return null;
  const count = Number.parseInt(raw, 10);
  return Number.isInteger(count) && count > 0 ? count : null;
}

/** Removes the chunks for a key without touching the count entry. */
async function removeChunks(key: string, count: number) {
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(chunkKey(key, i));
  }
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await readChunkCount(key);
    if (count === null) return null;

    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      // A missing chunk means the write was interrupted. Treat the whole
      // value as absent rather than returning a truncated session.
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    // Clear the previous value first, so shrinking from 3 chunks to 2 does not
    // leave an orphan behind.
    const previous = await readChunkCount(key);
    if (previous !== null) await removeChunks(key, previous);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(chunkKey(key, i), chunks[i]);
    }
    // Written last: until the count exists, getItem reports the key as absent,
    // so a partial write is never readable.
    await SecureStore.setItemAsync(key, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    const count = await readChunkCount(key);
    await SecureStore.deleteItemAsync(key);
    if (count !== null) await removeChunks(key, count);
  },
};
