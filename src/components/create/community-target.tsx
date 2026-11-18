import React, { useState } from "react";
import { Button, Sheet, T } from "../../ui";
import { useCommunities } from "../community-discovery";
import { getCommunity } from "../../domain/community-discovery";
export function CommunityTarget({
  id,
  onChange,
}: {
  id?: string;
  onChange: (id: string | undefined) => void;
}) {
  const { data } = useCommunities(),
    [open, O] = useState(false),
    c = getCommunity(id),
    joined = data?.communities.filter((c) => c.joined) ?? [];
  return (
    <>
      {c ? (
        <T small muted>
          Audience: {c.name} members. Posting identifies you as a participant;
          membership privacy does not hide posts.
        </T>
      ) : null}
      <Button
        label={
          c ? "Change community destination" : "Choose a community (optional)"
        }
        onPress={() => O(true)}
      />
      <Sheet visible={open} title="Post destination" onClose={() => O(false)}>
        <T>
          Choose a community you explicitly joined, or keep the existing feed
          audience.
        </T>
        <Button
          label="Use general feed"
          onPress={() => {
            onChange(undefined);
            O(false);
          }}
        />
        {!joined.length ? (
          <T>
            No joined communities. Join one in Discover before posting there.
          </T>
        ) : null}
        {joined.map((c) => (
          <Button
            key={c.id}
            label={`Post to ${c.name}`}
            selected={c.id === id}
            onPress={() => {
              onChange(c.id);
              O(false);
            }}
          />
        ))}
      </Sheet>
    </>
  );
}
