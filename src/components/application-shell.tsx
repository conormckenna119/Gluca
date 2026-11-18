import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Platform, type ViewStyle } from "react-native";
import {
  router,
  usePathname,
  useRootNavigationState,
  useNavigationContainerRef,
  type Href,
} from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Button, useColors } from "../ui";
import { useDemo } from "../store";
import { getFlags } from "../flags";
import {
  primaryNavigationVisible,
  primaryTabFor,
  tabVisible,
  existingTabTarget,
  type TabName,
} from "../nav";
import { ICONS } from "./primary-nav-icons";
const ITEMS = [
  ["index", "Home", "/"],
  ["glucose", "My Glucose", "/glucose"],
  ["create", "Create", "/create"],
  ["explore", "Explore", "/explore"],
  ["profile", "Profile", "/profile"],
] as const;
/** One persistent shell around the root Stack, rather than navigation owned by only five tab routes. */
export function ApplicationShell({
  children,
  covered,
  feedback,
}: {
  children: React.ReactNode;
  covered: boolean;
  feedback?: React.ReactNode;
}) {
  const pathname = usePathname(),
    c = useColors(),
    insets = useSafeAreaInsets(),
    { set } = useDemo();
  const [viewport, V] = useState<{ height: number; top: number } | null>(null);
  const rootState = useRootNavigationState();
  const navigation = useNavigationContainerRef();
  const navigate = (name: TabName, href: Href) => {
    const target = existingTabTarget(rootState, name);
    if (!target) {
      router.navigate(href);
      return;
    }
    // Pop detail routes first. NAVIGATE can focus/pop their parent stack itself;
    // popping afterward with the old count could remove the tab group and
    // reveal an earlier onboarding screen with a stale profile preview.
    if (target.pop.count)
      navigation.dispatch({
        type: "POP",
        target: target.pop.key,
        payload: { count: target.pop.count },
      });
    navigation.dispatch({
      type: "NAVIGATE",
      target: target.key,
      payload: { name, params: target.params },
    });
  };
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const visual = window.visualViewport;
    const resize = () =>
      V({
        height: Math.max(1, visual?.height ?? window.innerHeight),
        top: visual?.offsetTop ?? 0,
      });
    resize();
    window.addEventListener("resize", resize);
    visual?.addEventListener("resize", resize);
    visual?.addEventListener("scroll", resize);
    return () => {
      window.removeEventListener("resize", resize);
      visual?.removeEventListener("resize", resize);
      visual?.removeEventListener("scroll", resize);
    };
  }, []);
  const active = primaryTabFor(pathname),
    show = primaryNavigationVisible(pathname),
    flags = getFlags();
  const webBounds: ViewStyle = viewport
    ? {
        position: "absolute",
        left: 0,
        right: 0,
        top: viewport.top,
        height: viewport.height,
      }
    : {};
  const safeBottom =
    Platform.OS === "web"
      ? {
          paddingBottom:
            `max(4px, env(safe-area-inset-bottom, 0px))` as unknown as number,
        }
      : { paddingBottom: Math.max(4, insets.bottom) };
  return (
    <View style={[{ flex: 1, minHeight: 0, backgroundColor: c.bg }, webBounds]}>
      {!covered && !show ? (
        <View style={{ alignItems: "flex-end", backgroundColor: c.bg }}>
          <Button
            kind="ghost"
            label="Close"
            onPress={() => {
              if (pathname === "/welcome")
                set((s) => ({ ...s, seenWelcome: true }));
              router.replace("/create");
            }}
          />
        </View>
      ) : null}
      <View style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {children}
      </View>
      {!covered ? feedback : null}
      {!covered && show ? (
        <View
          role="tablist"
          accessibilityLabel="Primary navigation"
          style={[
            {
              flexDirection: "row",
              flexShrink: 0,
              minHeight: 72 + insets.bottom,
              paddingTop: 6,
              borderTopWidth: 1,
              borderTopColor: c.border,
              backgroundColor: c.surface,
            },
            safeBottom,
          ]}
        >
          {ITEMS.filter(([name]) => tabVisible(name, flags)).map(
            ([name, label, href]) => (
              <Pressable
                key={name}
                accessibilityRole="tab"
                accessibilityLabel={label}
                aria-selected={active === name}
                accessibilityState={{ selected: active === name }}
                onPress={() => navigate(name, href)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 56,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                }}
              >
                {name === "create" ? (
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: c.accent,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: -14,
                      borderWidth: 3,
                      borderColor: c.surface,
                    }}
                  >
                    <Svg
                      width={22}
                      height={22}
                      viewBox="0 0 24 24"
                      stroke={c.accentInk}
                      strokeWidth={2.6}
                      strokeLinecap="round"
                    >
                      <Path d="M12 5v14M5 12h14" />
                    </Svg>
                  </View>
                ) : (
                  ICONS[name]({
                    color: active === name ? c.accent : c.muted,
                    filled: active === name,
                  })
                )}
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 11.5,
                    fontWeight: "600",
                    color: active === name ? c.accent : c.muted,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ),
          )}
        </View>
      ) : null}
    </View>
  );
}
