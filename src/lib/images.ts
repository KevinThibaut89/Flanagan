import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Brings a photo down to what the model will actually look at before it goes
 * over the wire.
 *
 * OpenAI scales every image so its shortest side is 768px and its longest at
 * most 2048px before tokenising, so anything beyond that is upload time and
 * edge-function memory for detail that is thrown away on arrival. A phone
 * photo is 12–48 megapixels; 1536px on the long side keeps small label text
 * legible, costs the same number of image tokens, and is a tenth of the bytes.
 *
 * Returns JPEG base64, which is what the identify-bottles and read-recipe
 * functions take, and the new file's URI for the thumbnail.
 */
export const MODEL_IMAGE_MAX_SIDE = 1536;

/** JPEG quality for photos read by the model. Labels stay legible at this level. */
export const MODEL_IMAGE_QUALITY = 0.7;

export interface ModelImage {
  uri: string;
  base64: string;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
}

export async function shrinkForModel(
  uri: string,
  size?: { width: number; height: number } | null,
): Promise<ModelImage> {
  const context = ImageManipulator.manipulate(uri);

  // Only one side is given so the other follows the aspect ratio. Without
  // dimensions (the picker and camera both report them, so this is rare) the
  // photo is re-encoded as it is rather than guessed at — a resize with the
  // wrong side named would blow a small image up, never down.
  if (size && Math.max(size.width, size.height) > MODEL_IMAGE_MAX_SIDE) {
    if (size.width >= size.height) context.resize({ width: MODEL_IMAGE_MAX_SIDE });
    else context.resize({ height: MODEL_IMAGE_MAX_SIDE });
  }

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: MODEL_IMAGE_QUALITY,
    base64: true,
  });
  if (!saved.base64) throw new Error('Could not prepare that photo.');

  return {
    uri: saved.uri,
    base64: saved.base64,
    mimeType: 'image/jpeg',
    width: saved.width,
    height: saved.height,
  };
}
