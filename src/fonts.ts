// Inter for the artwork preview. Native SVG text needs a family per weight, so the map below feeds nativeSafe in story.ts.
import { useFonts } from "expo-font";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Inter_800ExtraBold } from "@expo-google-fonts/inter/800ExtraBold";
import { configureNativeFonts } from "./story";

/** Artwork font-weight -> family name registered with expo-font. */
export const ART_FONT_FAMILIES: Record<number, string> = {
  500: "Inter_500Medium",
  600: "Inter_600SemiBold",
  700: "Inter_700Bold",
  800: "Inter_800ExtraBold",
};

/** Loads Inter once. Returns true when loading has finished, whether it worked or not; a failure leaves the system face in place. */
export function useArtFonts(): boolean {
  const [loaded, error] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  // Configure during render (before children render) so the first preview already uses Inter.
  configureNativeFonts(loaded ? ART_FONT_FAMILIES : null);
  return loaded || !!error;
}
