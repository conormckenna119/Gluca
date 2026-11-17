import { recordAchievementEvent } from "../achievements/events";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  Text,
  View,
} from "react-native";
import { reactionCount, toggleReaction } from "../domain/reactions";
import {
  CHEER_LINE,
  canReact,
  countLine,
  gaveLine,
  nextBoostsGiven,
  reactionLabel,
  showCheerLine,
} from "../reaction-copy";
import { useDemo } from "../store";
import { Icon, T, radius, space, useColors } from "../ui";
import type { Post } from "../types";

/** The supportive reaction. Optimistic: the store changes on tap. Same control for everyone. */
export function BoostButton({ post }: { post: Post }) {
  const { state, set } = useDemo();
  const c = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [line, setLine] = useState("");

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        reduceMotion.current = v;
      })
      .catch(() => {});
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const given = post.reactions.mine === "boost";
  const n = reactionCount(post.reactions);
  const ownPost = post.author === "You";
  const blocked = !canReact(post.author, state.blocked);

  const pulse = () => {
    if (reduceMotion.current) return;
    scale.setValue(1);
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.3,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 130,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const press = () => {
    if (blocked) return;
    const nowGiven = !given;
    set((s) => {
      if (!canReact(post.author, s.blocked)) return s;
      return {
        ...s,
        posts: s.posts.map((p) =>
          p.id === post.id
            ? { ...p, reactions: toggleReaction(p.reactions) }
            : p,
        ),
        counters: {
          ...s.counters,
          boostsGiven: nextBoostsGiven(s.counters.boostsGiven, nowGiven),
        },
      };
    });
    if (timer.current) clearTimeout(timer.current);
    if (nowGiven) {
      recordAchievementEvent("support_given", `boost:${post.id}`);
      pulse();
      setLine(gaveLine(post.author));
      timer.current = setTimeout(() => setLine(""), 3000);
    } else {
      setLine("");
    }
  };

  const text = ownPost ? (n > 0 ? String(n) : "") : countLine(n);
  const ink = given ? c.accent : c.muted;
  return (
    <View style={{ gap: space.xs }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: space.sm,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={reactionLabel(n, given)}
          accessibilityState={{ selected: given, disabled: blocked }}
          disabled={blocked}
          onPress={press}
          hitSlop={4}
          style={({ pressed }) => ({
            minWidth: 44,
            minHeight: 44,
            paddingHorizontal: space.sm,
            flexDirection: "row",
            gap: 6,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.pill,
            backgroundColor: pressed ? c.raised : "transparent",
            opacity: blocked ? 0.45 : 1,
          })}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <Icon name="bolt" filled={given} color={ink} />
          </Animated.View>
          {text ? (
            <Text
              style={{
                color: given ? c.text : c.muted,
                fontSize: 14,
                fontWeight: "700",
              }}
            >
              {text}
            </Text>
          ) : null}
        </Pressable>
        {ownPost && n > 0 ? (
          <T small muted>
            {countLine(n, true)}
          </T>
        ) : null}
      </View>
      {showCheerLine(n, ownPost) ? (
        <T small muted>
          {CHEER_LINE}
        </T>
      ) : null}
      <View accessibilityLiveRegion="polite" aria-live="polite">
        {line ? (
          <T small muted>
            {line}
          </T>
        ) : null}
      </View>
    </View>
  );
}
