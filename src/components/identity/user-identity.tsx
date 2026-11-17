import React from "react";
import { Image, View } from "react-native";
import { Avatar, T, space } from "../../ui";
import { NameLine } from "./name-line";
import type { PublicProfile } from "../../domain/profile";
import { useDemo } from "../../store";
import { publicView } from "../../domain/public-view";
import { localToday } from "../../domain/shield";
import { demoMember } from "../../demo-members";
import { TYPE_LABEL, CGM_LABEL, DELIVERY_LABEL } from "../../domain/onboarding";
export function useUserIdentity(name: string) {
  const { state } = useDemo();
  return name === "You"
    ? publicView(state.profile, state.privacy, {
        today: localToday(),
        clubs: state.clubs,
        clubVisibility: state.clubVisibility,
        awards: state.awards,
      })
    : demoMember(name);
}
/** Receives only the allowlisted public view, never a private medical profile. */
export function UserIdentity({
  profile,
  expanded = false,
  photo = true,
}: {
  profile: PublicProfile;
  expanded?: boolean;
  photo?: boolean;
}) {
  const size = expanded ? 76 : 36;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        minWidth: 0,
        flex: expanded ? undefined : 1,
      }}
    >
      {photo ? (
        profile.photo ? (
          <Image
            source={{ uri: profile.photo }}
            accessibilityLabel={`${profile.name}'s profile photo`}
            style={{ width: size, height: size, borderRadius: size / 2 }}
          />
        ) : (
          <Avatar name={profile.name} size={size} />
        )
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <NameLine name={profile.name} publicProfile={profile} />
        {profile.username ? (
          <T small muted>
            @{profile.username}
          </T>
        ) : null}
        {expanded && profile.bio ? <T>{profile.bio}</T> : null}
        {expanded && profile.diabetesType ? (
          <T small muted>
            {TYPE_LABEL[profile.diabetesType]}
          </T>
        ) : null}
        {expanded && profile.cgm ? (
          <T small muted>
            CGM · {CGM_LABEL[profile.cgm.brand]} {profile.cgm.model ?? ""}
          </T>
        ) : null}
        {expanded && profile.delivery ? (
          <T small muted>
            Delivery · {DELIVERY_LABEL[profile.delivery.method]}{" "}
            {profile.delivery.model ?? ""}
          </T>
        ) : null}
        {expanded && profile.birthdayToday ? (
          <T small>Celebrating a birthday today</T>
        ) : null}
      </View>
    </View>
  );
}
export function AuthorIdentity({
  name,
  photo = true,
}: {
  name: string;
  photo?: boolean;
}) {
  return <UserIdentity profile={useUserIdentity(name)} photo={photo} />;
}
