import React, { useEffect, useRef, useState } from "react";
import { Button, Notice, Sheet, T } from "../ui";
import { socialRequest } from "../services/social";
import { captureAchievementScope } from "../achievements/events";
import { onSessionEvent } from "../services/session-events";
const REASONS = [
  ["spam", "Spam"],
  ["harassment", "Harassment"],
  ["privacy", "Privacy concern"],
  ["unsafe_advice", "Unsafe advice"],
  ["other", "Other concern"],
] as const;
export function ReportAction({
  kind,
  id,
  visible,
  onClose,
  hideTrigger = false,
}: {
  kind: "post" | "comment" | "community";
  id: string;
  visible?: boolean;
  onClose?: () => void;
  hideTrigger?: boolean;
}) {
  const [localOpen, LOCAL] = useState(false),
    [busy, B] = useState(false),
    [message, M] = useState("");
  const open = visible ?? localOpen;
  const O = (value: boolean) => {
    LOCAL(value);
    if (!value) onClose?.();
  };
  const lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const stop = onSessionEvent(() => {
      O(false);
      M("");
    });
    return () => {
      alive.current = false;
      stop();
    };
  }, []);
  const report = async (reason: string) => {
    if (lock.current) return;
    lock.current = true;
    B(true);
    const scope = captureAchievementScope();
    try {
      await socialRequest("report", { kind, id, reason }, "/api/communities");
      if (alive.current && scope === captureAchievementScope()) {
        M("Report recorded.");
        O(false);
      }
    } catch {
      if (alive.current && scope === captureAchievementScope())
        M("Report could not be saved. Please retry.");
    } finally {
      lock.current = false;
      if (alive.current) B(false);
    }
  };
  return (
    <>
      {!hideTrigger ? (
        <Button label={`Report ${kind}`} onPress={() => O(true)} />
      ) : null}
      {message ? <Notice>{message}</Notice> : null}
      <Sheet visible={open} title={`Report ${kind}`} onClose={() => O(false)}>
        <T>
          Choose a concern. Do not include anyone’s private health information.
        </T>
        {REASONS.map(([id, label]) => (
          <Button
            key={id}
            label={label}
            disabled={busy}
            onPress={() => void report(id)}
          />
        ))}
      </Sheet>
    </>
  );
}
