import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import { router, usePathname } from "expo-router";
import { Button, Eyebrow, T, radius, space, useColors } from "../../ui";
import { Medal } from "./medal";
import {
  dismissUnlock,
  useAchievements,
  useUnlockQueue,
} from "../../hooks/use-achievements";
import { getDef } from "../../achievements/registry";
import { captureAchievementScope } from "../../achievements/events";
/** Only new repository awards enter this session queue. Quietly defer feedback throughout editing. */
export function UnlockToastHost() {
  const c = useColors(),
    pathname = usePathname(),
    queue = useUnlockQueue(),
    { enabled, awards, status } = useAchievements();
  const [reduce, setReduce] = useState(true),
    progress = useRef(new Animated.Value(1)).current,
    closing = useRef(false);
  const [screenReader, setScreenReader] = useState(true);
  const currentId = queue[0],
    award = awards.find((a) => a.id === currentId && !a.withdrawn),
    def = award && getDef(award.achievementId);
  const eligible =
    enabled &&
    award &&
    def &&
    def.category !== "health" &&
    def.id !== "diagnosis_anniversary";
  const blocked = [
    "/create",
    "/onboarding",
    "/profile-edit",
    "/account",
    "/welcome",
  ].some((p) => pathname === p || pathname.startsWith(p + "/"));
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduce(v);
      })
      .catch(() => {});
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => {
        if (alive) setScreenReader(v);
      })
      .catch(() => {});
    const readerListener = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setScreenReader,
    );
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    return () => {
      alive = false;
      listener.remove();
      readerListener.remove();
    };
  }, []);
  useEffect(() => {
    if (enabled && status !== "checking" && currentId && !eligible)
      dismissUnlock(currentId);
  }, [enabled, status, currentId, eligible]);
  useEffect(() => {
    closing.current = false;
    progress.stopAnimation();
    progress.setValue(1);
    if (!eligible || blocked || reduce) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [currentId, !!eligible, blocked, reduce, progress]);
  const finish = (view = false) => {
    if (!currentId || closing.current) return;
    closing.current = true;
    const scope = captureAchievementScope(),
      id = currentId;
    const done = () => {
      if (scope !== captureAchievementScope()) return;
      dismissUnlock(id);
      if (view)
        router.push(`/trophies?award=${encodeURIComponent(id)}` as never);
    };
    if (reduce) {
      done();
      return;
    }
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) done();
    });
  };
  useEffect(() => {
    if (!eligible || blocked || screenReader) return;
    const timer = setTimeout(() => finish(), 8000);
    return () => clearTimeout(timer);
  }, [currentId, !!eligible, blocked, screenReader, reduce]);
  if (!eligible || blocked || !award || !def) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        flexShrink: 0,
        alignItems: "center",
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
      }}
    >
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [6, 0],
              }),
            },
          ],
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
        }}
      >
        <Medal
          icon={def.icon}
          category={def.category}
          name={def.name}
          earnedAt={award.awardedAt}
          size={48}
          decorative
        />
        <View style={{ flex: 1, gap: space.xs }}>
          <Eyebrow>Achievement unlocked</Eyebrow>
          <T bold>{def.name}</T>
          <T small muted>
            {def.description}
          </T>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}
          >
            <Button label="View Achievement" onPress={() => finish(true)} />
            <Button kind="ghost" label="Dismiss" onPress={() => finish()} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}
