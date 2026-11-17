import React, { useState, useRef, useEffect } from "react";
import { BRAND } from "../../art/brand";
import { Image, Platform, View } from "react-native";
import { Button, Notice, T, radius, space, useColors } from "../../ui";

export function PhotoBackground({
  photoUri,
  onChange,
}: {
  photoUri: string | null;
  onChange: (uri: string | null) => void;
}) {
  const c = useColors();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const alive = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const pick = async () => {
    if (pending.current) return;
    pending.current = true;
    setPicking(true);
    setError(null);
    try {
      const picker = await import("expo-image-picker");
      // The system photo picker needs no permission on web, iOS 14+ or Android 13+; only ask where it is required.
      if (Platform.OS === "android" || Platform.OS === "ios") {
        const perm = await picker.getMediaLibraryPermissionsAsync(false);
        if (!perm.granted && perm.canAskAgain === false) {
          if (alive.current)
            setError(
              `${BRAND.name} can't open your photos. Allow photo access for ${BRAND.name} in your device settings, then try again.`,
            );
          return;
        }
      }
      const result = await picker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (!alive.current || result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (uri) onChange(uri);
      else setError("That photo could not be read. Try a different one.");
    } catch {
      if (alive.current)
        setError(
          "The photo library could not be opened. Check that photo access is allowed, then try again.",
        );
    } finally {
      pending.current = false;
      if (alive.current) setPicking(false);
    }
  };

  return (
    <View style={{ gap: space.md }}>
      {photoUri ? (
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: space.md }}
        >
          <Image
            source={{ uri: photoUri }}
            accessibilityLabel="Thumbnail of the photo behind your graphic"
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.md,
              backgroundColor: c.raised,
            }}
          />
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: space.sm,
            }}
          >
            <Button
              label={picking ? "Opening photos…" : "Change photo"}
              disabled={picking}
              onPress={pick}
            />
            <Button
              label="Remove photo"
              disabled={picking}
              kind="ghost"
              onPress={() => {
                setError(null);
                onChange(null);
              }}
            />
          </View>
        </View>
      ) : (
        <View style={{ alignItems: "flex-start" }}>
          <Button
            label={picking ? "Opening photos…" : "Add a photo behind it"}
            disabled={picking}
            onPress={pick}
          />
        </View>
      )}
      <T small muted>
        The photo stays on this device and is only used for this image.
      </T>
      {error ? (
        <Notice tone="error" title="Photo not added">
          {error}
        </Notice>
      ) : null}
    </View>
  );
}
