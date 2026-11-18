import { Platform } from "react-native";
import { formats } from "./story";
import { coverFit } from "./cover-fit";
export async function exportImage(
  svg: string,
  format: keyof typeof formats,
  nativeCapture: () => Promise<string>,
  save = false,
  filename = `gluca-${format.toLowerCase()}.png`,
  backgroundUri?: string,
  retainImage = false,
  shouldContinue = () => true,
  download = true,
) {
  if (Platform.OS === "web") {
    const [w, h] = formats[format];
    const img = new Image();
    let photo: HTMLImageElement | null = null;
    if (backgroundUri) {
      photo = new Image();
      const p = photo;
      await new Promise<void>((resolve, reject) => {
        p.onload = () => resolve();
        p.onerror = () => reject(new Error("Unable to read the photo."));
        p.src = backgroundUri;
      });
    }
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
      await new Promise<void>((resolve, reject) => {
        img.decoding = "async";
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Unable to render graphic."));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable.");
      const paint = () => {
        ctx.clearRect(0, 0, w, h);
        if (photo) {
          const r = coverFit(photo.naturalWidth, photo.naturalHeight, w, h);
          ctx.drawImage(photo, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
      };
      paint();
      // Some browsers decode the embedded font lazily; draw again so the first frame never uses a fallback face.
      await new Promise((r) => setTimeout(r, 60));
      paint();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("PNG export failed."))),
          "image/png",
        ),
      );
      const dataUri = retainImage
        ? await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () =>
              reject(new Error("Unable to prepare the exported image."));
            reader.readAsDataURL(blob);
          })
        : null;
      if (!shouldContinue())
        throw new Error("Export cancelled because the account changed.");
      const output = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = output;
      a.download = filename;
      if (download) a.click();
      setTimeout(() => URL.revokeObjectURL(output), 10000);
      return { dataUri, width: w, height: h };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const uri = await nativeCapture();
  if (!shouldContinue())
    throw new Error("Export cancelled because the account changed.");
  if (save) {
    const media = await import("expo-media-library");
    const permission = await media.requestPermissionsAsync(true);
    if (!permission.granted)
      throw new Error("Photo library permission was not granted.");
    await media.saveToLibraryAsync(uri);
  } else {
    const sharing = await import("expo-sharing");
    if (!(await sharing.isAvailableAsync()))
      throw new Error("Sharing is unavailable on this device.");
    await sharing.shareAsync(uri, { mimeType: "image/png" });
  }
  return {
    dataUri: null,
    width: formats[format][0],
    height: formats[format][1],
  };
}
