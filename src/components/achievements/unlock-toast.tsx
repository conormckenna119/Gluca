import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import { router } from "expo-router";
import { Button, Eyebrow, T, radius, space, useColors } from "../../ui";
import { Medal } from "./medal";
import {
  dismissUnlock,
  useAchievements,
  useUnlockQueue,
} from "../../hooks/use-achievements";
import { useDemo } from "../../store";
import { getDef } from "../../achievements/registry";

/** Calm, one-at-a-time announcement of a newly earned medal. Mount once in the root layout. */
export function UnlockToastHost() {
  const c = useColors();
  const { state, ready } = useDemo();
  const { enabled } = useAchievements();
  const queue = useUnlockQueue();
  const scale = useRef(new Animated.Value(1)).current;
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduce)
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    return () => listener.remove();
  }, []);

  // Health medals are announced only when the person turned notifications on; skipped ones are simply not announced.
  const announce = (id: string) => {
    const a = state.awards.find((x) => x.id === id);
    const d = a && getDef(a.achievementId);
    if (!a || !d || a.withdrawn) return null;
    if (d.category === "health" && !state.privacy.achievementNotifications)
      return null;
    return { a, d };
  };
  const currentId = queue[0];
  const item = enabled && ready && currentId ? announce(currentId) : null;

  useEffect(() => {
    if (enabled && ready && currentId && !item) dismissUnlock(currentId);
  }, [enabled, ready, currentId, item]);

  useEffect(() => {
    scale.stopAnimation();
    scale.setValue(1);
    if (!item || reduce) return;
    scale.setValue(0.96);
    const animation = Animated.timing(scale, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [item?.a.id, reduce, scale]);

  if (!item) return null;
  const { a, d } = item;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 84,
        alignItems: "center",
        paddingHorizontal: space.lg,
      }}
    >
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{
          width: "100%",
          maxWidth: 440,
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          padding: space.md,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
          shadowColor: "#000",
          shadowOpacity: 0.3,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Medal
            icon={d.icon}
            category={d.category}
            name={d.name}
            earnedAt={a.awardedAt}
            size={64}
            decorative
          />
        </Animated.View>
        <View style={{ flex: 1, gap: space.xs }}>
          <Eyebrow>New medal</Eyebrow>
          <T bold>{d.name}</T>
          <View
            style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}
          >
            <Button
              label="View"
              onPress={() => {
                dismissUnlock(a.id);
                router.push(
                  `/trophies?award=${encodeURIComponent(a.id)}` as never,
                );
              }}
            />
            <Button
              kind="ghost"
              label="Dismiss"
              onPress={() => dismissUnlock(a.id)}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
