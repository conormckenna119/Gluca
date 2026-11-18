import { onSocialRefresh, refreshSocial } from "../services/social";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useDemo } from "../store";
import { getFlags } from "../flags";
import { onSessionEvent } from "../services/session-events";
import { feedRequest, onFeedPublished } from "../services/feed-posts";
/** Account feed data is memory-only; legacy fictional/local posts stay separate. */
export function useFeedPosts() {
  const { set, ready } = useDemo();
  useEffect(() => {
    if (
      !ready ||
      Platform.OS !== "web" ||
      !getFlags().accounts ||
      !getFlags().communityFeed
    )
      return;
    let generation = 0,
      alive = true;
    const clear = () => {
      generation++;
      set((s) => ({ ...s, posts: s.posts.filter((p) => !p.remote) }));
    };
    const load = async () => {
      const mine = ++generation;
      try {
        const posts = await feedRequest();
        if (alive && mine === generation)
          set((s) => ({
            ...s,
            posts: [...posts, ...s.posts.filter((p) => !p.remote)],
          }));
      } catch {
        if (alive && mine === generation)
          set((s) => ({ ...s, posts: s.posts.filter((p) => !p.remote) }));
      }
    };
    void load();
    const stop = onSessionEvent((e, _remote, reason) => {
      if (reason !== "account") return;
      if (e === "check") void load();
      else clear();
    });
    let resumedAt = 0;
    const resume = () => {
      if (
        document.visibilityState !== "hidden" &&
        Date.now() - resumedAt > 1000
      ) {
        resumedAt = Date.now();
        refreshSocial();
      }
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    const interval = setInterval(resume, 30000);
    const refresh = onSocialRefresh(() => void load());
    const update = onFeedPublished((p) => {
      generation++;
      set((s) => ({
        ...s,
        posts: s.posts.some((x) => x.id === p.id)
          ? s.posts.map((x) => (x.id === p.id ? p : x))
          : [p, ...s.posts],
      }));
    });
    return () => {
      alive = false;
      generation++;
      stop();
      update();
      refresh();
      clearInterval(interval);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [ready, set]);
}
