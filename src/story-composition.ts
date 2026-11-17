/** Background first; the existing SVG paints glucose, captions/statistics and ornaments above it. */
export const PHOTO_LAYER = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 0,
};
export const ARTWORK_LAYER = { ...PHOTO_LAYER, zIndex: 1 };
/** One background policy for the preview, native capture and web PNG renderer. Never mutates editor settings. */
export function storyComposition(
  transparent: boolean,
  photoUri: string | null,
) {
  const photo = transparent && photoUri ? photoUri : null;
  return {
    photoUri: photo,
    background: photo
      ? ("photo" as const)
      : transparent
        ? ("transparent" as const)
        : ("colour" as const),
  };
}
