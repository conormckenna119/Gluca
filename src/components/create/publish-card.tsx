import { CommunityTarget } from "./community-target";
import React from "react";
import { View } from "react-native";
import { Button, Card, Input, SwitchRow, T, row } from "../../ui";
/** Existing publisher, now bound to the exact exported PNG rather than a separate numerical snapshot. */
export function PublishCard({
  enabled,
  onEnabled,
  caption,
  onCaption,
  visibility,
  onVisibility,
  available,
  communityId,
  onCommunity,
}: {
  communityId?: string;
  onCommunity?: (id: string | undefined) => void;
  enabled: boolean;
  onEnabled: (v: boolean) => void;
  caption: string;
  onCaption: (v: string) => void;
  visibility: "private" | "public";
  onVisibility: (v: "private" | "public") => void;
  available: boolean;
}) {
  return (
    <Card>
      <SwitchRow
        title="Also post to Gluca"
        value={enabled}
        onChange={(v) => {
          if (available || !v) onEnabled(v);
        }}
      />
      {!available ? (
        <T small muted>
          Sign in on the web app to post. Exporting works without an account.
        </T>
      ) : null}
      {enabled ? (
        <>
          <Input
            label="Post caption (optional)"
            value={caption}
            onChange={(v) => onCaption(v.slice(0, 1000))}
            multiline
          />
          <T small bold>
            Audience
          </T>
          {onCommunity ? (
            <CommunityTarget id={communityId} onChange={onCommunity} />
          ) : null}
          {!communityId ? (
            <>
              <View style={row}>
                {(["private", "public"] as const).map((v) => (
                  <Button
                    key={v}
                    label={v === "private" ? "Private" : "Public"}
                    selected={visibility === v}
                    onPress={() => onVisibility(v)}
                  />
                ))}
              </View>
              <T small muted>
                {visibility === "private"
                  ? "Only your signed-in account can view this post."
                  : "Visible to other signed-in Gluca users. The image includes only the graphic you confirm."}{" "}
                Followers-only is not available.
              </T>
            </>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
