import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  COMMUNITY_CATALOGUE,
  COMMUNITY_CATEGORIES,
  discoverCommunities,
  recommendedCommunityIds,
  type CommunityDefinition,
} from "../domain/community-discovery";
import { localToday } from "../domain/shield";
import { useDemo } from "../store";
import { useResource } from "./social-interactions";
import { Button, Card, Chip, Input, Notice, Pill, T, space } from "../ui";
export type AccountCommunity = CommunityDefinition & {
  joined: boolean;
  visible: boolean;
  restricted: boolean;
  memberCount: number;
};
export function useCommunities() {
  return useResource<{ communities: AccountCommunity[] }>(
    "",
    "/api/communities",
  );
}
export function OwnCommunities() {
  const { data } = useCommunities(),
    { state } = useDemo();
  if (!data) return null;
  const joined = data.communities.filter((c) => c.joined);
  return (
    <Card>
      <T bold>Your communities</T>
      {joined.length ? (
        joined.map((c) => (
          <View key={c.id}>
            <T small muted>
              {c.visible && state.privacy.showMemberships
                ? "Public membership"
                : "Private membership"}
            </T>
            <Button
              label={`Open ${c.name}`}
              onPress={() => router.push(`/community/${c.id}` as never)}
            />
          </View>
        ))
      ) : (
        <T small muted>
          No joined communities.
        </T>
      )}
      <Button
        label="Discover communities"
        onPress={() => router.push("/explore")}
      />
    </Card>
  );
}
export function CommunityDiscovery() {
  const { state } = useDemo(),
    { data, error, reload } = useCommunities();
  const [query, Q] = useState(""),
    [category, C] = useState("All"),
    [mine, M] = useState(false);
  const joined =
    data?.communities.filter((c) => c.joined).map((c) => c.id) ?? [];
  const recommendations = recommendedCommunityIds(
    state.profile,
    localToday(),
    joined,
  );
  const card = (c: CommunityDefinition) => {
    const account = data?.communities.find((x) => x.id === c.id);
    return (
      <Card key={c.id}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Pill>{c.category}</Pill>
          {account?.joined ? (
            <Pill tone="accent">
              Joined
              {account.visible && state.privacy.showMemberships
                ? " · Public"
                : " · Private"}
            </Pill>
          ) : null}
        </View>
        <T heading>{c.name}</T>
        <T small muted>
          {c.blurb}
        </T>
        {account ? (
          <T small muted>
            {account.memberCount} public members
          </T>
        ) : null}
        <Button
          label={`Explore ${c.name}`}
          onPress={() => router.push(`/community/${c.id}` as never)}
        />
      </Card>
    );
  };
  const showRecommendations = !query && category === "All" && !mine;
  const list = discoverCommunities(query, category).filter(
    (c) =>
      (!mine || joined.includes(c.id)) &&
      (!showRecommendations || !recommendations.includes(c.id)),
  );
  return (
    <View style={{ gap: space.lg }}>
      <T heading>Discover</T>
      <T small muted>
        Browse shared interests. Joining is optional and private by default.
      </T>
      <Input label="Search communities" value={query} onChange={Q} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {COMMUNITY_CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={c}
            selected={c === category}
            onPress={() => C(c)}
          />
        ))}
        <Chip label="My communities" selected={mine} onPress={() => M(!mine)} />
      </View>
      {error ? (
        <>
          <Notice>
            Sign in to load memberships, or keep browsing. Your private profile
            is never shared as a recommendation.
          </Notice>
          <Button label="Retry memberships" onPress={() => void reload()} />
        </>
      ) : null}
      {!query && category === "All" && !mine && recommendations.length ? (
        <View style={{ gap: space.md }}>
          <T bold>Suggested for you</T>
          <T small muted>
            Based on information you volunteered. Suggestions are visible only
            to you.
          </T>
          {COMMUNITY_CATALOGUE.filter((c) =>
            recommendations.includes(c.id),
          ).map(card)}
        </View>
      ) : null}
      <T bold>{mine ? "Your communities" : "Browse communities"}</T>
      {list.map(card)}
      {!list.length ? (
        <T muted>
          {mine
            ? "No joined communities match. Browse All to find one."
            : "No communities match your search."}
        </T>
      ) : null}
    </View>
  );
}
