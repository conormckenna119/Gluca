import React, { useState, useRef, useEffect } from "react";
import { View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Button, Input, T, space } from "../../ui";
import {
  sanitizeProfile,
  type Profile,
  type PrivacySettings,
} from "../../domain/profile";
import { publicView } from "../../domain/public-view";
import { localToday } from "../../domain/shield";
import { UserIdentity } from "./user-identity";
export function ProfileFields({
  profile: p,
  privacy,
  patch,
}: {
  profile: Profile;
  privacy: PrivacySettings;
  patch: (p: Partial<Profile>) => void;
}) {
  const [error, E] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const photo = async () => {
    E("");
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        E("Photo access was not granted. You can keep your initials.");
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.15,
        base64: true,
      });
      if (r.canceled) return;
      const asset = r.assets[0],
        side = Math.min(asset.width, asset.height);
      const context = ImageManipulator.manipulate(asset.uri);
      context
        .crop({
          originX: Math.floor((asset.width - side) / 2),
          originY: Math.floor((asset.height - side) / 2),
          width: side,
          height: side,
        })
        .resize({ width: 128, height: 128 });
      const image = await context.renderAsync();
      let value: string;
      try {
        const saved = await image.saveAsync({
          format: SaveFormat.JPEG,
          compress: 0.7,
          base64: true,
        });
        value = `data:image/jpeg;base64,${saved.base64 ?? ""}`;
      } finally {
        image.release();
        context.release();
      }
      const checked = sanitizeProfile({ photo: value });
      if (!alive.current) return;
      if (!checked.photo) {
        E(
          "Choose a small cropped JPEG photo (under 18 KB). You can continue without one.",
        );
        return;
      }
      patch({ photo: checked.photo });
    } catch {
      E("The photo could not be opened. You can continue with initials.");
    }
  };
  return (
    <View style={{ gap: space.md }}>
      <UserIdentity
        expanded
        profile={publicView(p, privacy, {
          today: localToday(),
          clubs: [],
          clubVisibility: {},
          awards: [],
        })}
      />
      <Input
        label="Display name"
        value={p.displayName === "You" ? "" : p.displayName}
        maxLength={40}
        onChange={(displayName) => patch({ displayName: displayName || "You" })}
      />
      <Input
        label="Public username (optional)"
        value={p.username ?? ""}
        maxLength={30}
        plainText
        onChange={(username) => patch({ username: username.toLowerCase() })}
      />
      <T small muted>
        Your public handle is separate from your sign-in username. Letters,
        numbers, dot, dash or underscore; 3–30 characters.
      </T>
      <Input
        label="Short bio (optional, public)"
        value={p.bio ?? ""}
        maxLength={160}
        onChange={(bio) => patch({ bio })}
      />
      <Button label="Choose profile photo" onPress={() => void photo()} />
      {p.photo ? (
        <Button
          label="Remove profile photo"
          onPress={() => patch({ photo: undefined })}
        />
      ) : null}
      <T small muted>
        Name, handle, bio and photo are public profile fields when you save.
        Medical details stay private unless you switch them on.
      </T>
      {error ? <T>{error}</T> : null}
    </View>
  );
}
