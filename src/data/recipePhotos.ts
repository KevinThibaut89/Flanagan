import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/auth';
import { queryKeys } from './keys';

/**
 * A picture of the finished drink, attached to a saved recipe.
 *
 * Photos live in the `recipe-photos` bucket at
 * `<user id>/<recipe id>/<stamp>.<ext>` and the recipe row stores the object's
 * public URL. Every upload gets a fresh stamp so a replaced photo has a new
 * URL — expo-image caches by URL, and reusing the path would keep showing the
 * old picture until the cache expired.
 */

const BUCKET = 'recipe-photos';
const PHOTO_QUALITY = 0.7;

export interface PickedPhoto {
  uri: string;
  mimeType: string;
  /** Only present when asked for; a base64 photo is megabytes of JS memory. */
  base64?: string;
}

export type PhotoSource = 'camera' | 'library';

/**
 * Opens the camera or the photo library and hands back the chosen picture, or
 * null when the user backs out. Throws when the picker itself fails or a
 * permission is refused, with a message fit for showing as-is.
 *
 * `base64` is for callers that send the picture to an edge function rather
 * than upload it: the recipe scanner needs the bytes in JS, the photo upload
 * streams them from disk instead.
 */
export async function pickRecipePhoto(
  source: PhotoSource,
  { base64 = false, quality = PHOTO_QUALITY }: { base64?: boolean; quality?: number } = {},
): Promise<PickedPhoto | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality,
    exif: false,
    base64,
  };

  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Camera access is off for Flanagan — you can turn it on in Settings.');
    }
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }

  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.uri) throw new Error('Could not read that photo.');
  if (base64 && !asset.base64) throw new Error('Could not read that photo.');

  // The picker re-encodes to JPEG whenever it applies `quality`; the mime type
  // is only ever something else when it hands the file back untouched.
  return {
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    ...(base64 && asset.base64 ? { base64: asset.base64 } : {}),
  };
}

function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    default:
      return 'jpg';
  }
}

/** Recovers the bucket path from a public URL, for deleting the object. */
export function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const path = url.slice(at + marker.length).split('?')[0];
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/**
 * Best-effort removal of a stored photo. Failures are swallowed on purpose:
 * an orphaned object costs a few hundred kilobytes, whereas surfacing the
 * error would block the action the user actually asked for.
 */
export async function removeStoredPhoto(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const path = storagePathFromPublicUrl(url);
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]).then(
    () => undefined,
    () => undefined,
  );
}

async function uploadPhoto(userId: string, recipeId: string, photo: PickedPhoto): Promise<string> {
  // Streaming the file through fetch keeps it out of JS memory as base64.
  const body = await fetch(photo.uri).then((response) => response.arrayBuffer());
  if (body.byteLength === 0) throw new Error('That photo came back empty.');

  const path = `${userId}/${recipeId}/${Date.now()}.${extensionFor(photo.mimeType)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: photo.mimeType,
    upsert: false,
  });
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Uploads a picked photo and points the recipe at it, replacing any previous one. */
export function useSetRecipePhoto() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      recipeId,
      photo,
      previousUrl,
    }: {
      recipeId: string;
      photo: PickedPhoto;
      previousUrl: string | null;
    }): Promise<string> => {
      if (!user) throw new Error('Not signed in.');

      const url = await uploadPhoto(user.id, recipeId, photo);

      const { error } = await supabase
        .from('recipes')
        .update({ image_url: url })
        .eq('id', recipeId);
      if (error) {
        // The row still points at the old picture, so drop the one we just
        // uploaded rather than the one still in use.
        await removeStoredPhoto(url);
        throw error;
      }

      await removeStoredPhoto(previousUrl);
      return url;
    },
    onSuccess: (_url, { recipeId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipe(recipeId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipes(user?.id) });
    },
  });
}

/** Clears the recipe's photo and deletes the stored object. */
export function useRemoveRecipePhoto() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ recipeId, url }: { recipeId: string; url: string }): Promise<void> => {
      const { error } = await supabase
        .from('recipes')
        .update({ image_url: null })
        .eq('id', recipeId);
      if (error) throw error;
      await removeStoredPhoto(url);
    },
    onSuccess: (_data, { recipeId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipe(recipeId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.recipes(user?.id) });
    },
  });
}
