import React, { useState } from "react";
import { Button, T } from "../../ui";
import { useDemo } from "../../store";
import { sanitizeProfile, sanitizePrivacy } from "../../domain/profile";
import { validatePublicFields } from "../../domain/profile-experience";
export function ProfileSave({ disabled = false }: { disabled?: boolean }) {
  const { state, saveProfile, profileStatus, reloadProfile } = useDemo(),
    [message, M] = useState(""),
    [busy, B] = useState(false);
  return (
    <>
      <Button
        label={busy ? "Saving profile…" : "Save profile and privacy"}
        disabled={
          disabled ||
          busy ||
          profileStatus === "checking" ||
          profileStatus === "unavailable"
        }
        onPress={() => {
          M("");
          B(true);
          void (async () => {
            try {
              const error = validatePublicFields(state.profile);
              if (error) throw new Error(error);
              await saveProfile(
                sanitizeProfile(state.profile),
                sanitizePrivacy(state.privacy),
              );
              M(
                profileStatus === "account"
                  ? "Saved to your protected account."
                  : "Saved for this open app only. Sign in for account storage.",
              );
            } catch (e) {
              M(e instanceof Error ? e.message : "Profile could not be saved.");
            } finally {
              B(false);
            }
          })();
        }}
      />
      {message ? <T>{message}</T> : null}
      {profileStatus === "unavailable" ? (
        <>
          <T>Profile service unavailable. Your changes have not been saved.</T>
          <Button
            label="Reload saved account profile"
            onPress={() => void reloadProfile()}
          />
        </>
      ) : null}
    </>
  );
}
