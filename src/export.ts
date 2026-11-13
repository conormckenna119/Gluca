import { Platform } from "react-native";
import { formats } from "./story";
export async function exportImage(
  svg: string,
  format: keyof typeof formats,
  nativeCapture: () => Promise<string>,
  save = false,
  filename = `gluca-${format.toLowerCase()}.png`,
) {
  if (Platform.OS === "web") {
    const [w, h] = formats[format];
    const img = new Image();
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
      ctx.drawImage(img, 0, 0, w, h);
      // Some browsers decode the embedded font lazily; draw again so the first frame never uses a fallback face.
      await new Promise((r) => setTimeout(r, 60));
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("PNG export failed."))),
          "image/png",
        ),
      );
      const output = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = output;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(output), 10000);
    } finally {
      URL.revokeObjectURL(url);
    }
    return;
  }
  const uri = await nativeCapture();
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
}
