import type { ShelfMimeType } from './identify';

/**
 * Hands one shelf photo from the scanner to the review screen.
 *
 * A base64 photo is megabytes — far too big for a route param — and there is
 * no file-system module to round-trip it through disk. The scanner sets it,
 * the review screen takes it (once), and nothing else ever reads it, so a
 * module-level slot is the smallest thing that works.
 */
export interface ShelfCapture {
  /** Local file or content URI, for the thumbnail. */
  uri: string;
  base64: string;
  mimeType: ShelfMimeType;
}

let pending: ShelfCapture | null = null;

export function setPendingCapture(capture: ShelfCapture): void {
  pending = capture;
}

/** Returns the waiting capture and clears the slot, so a stale one is never reused. */
export function takePendingCapture(): ShelfCapture | null {
  const capture = pending;
  pending = null;
  return capture;
}
