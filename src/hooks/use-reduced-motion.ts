import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
/** Start static until the platform preference resolves, and respond to changes. */
export function useReducedMotion() {
  const [reduced, R] = useState(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) R(v);
      })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      R,
    );
    return () => {
      alive = false;
      listener.remove();
    };
  }, []);
  return reduced;
}
