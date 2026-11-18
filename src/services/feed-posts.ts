import type { Post } from "../types";
export type PublishInput = {
  requestId: string;
  image: string;
  title: string;
  caption: string;
  alt: string;
  visibility: "private" | "public";
};
export async function feedRequest(body?: PublishInput): Promise<Post[]> {
  const r = await fetch("/api/posts", {
    method: body ? "POST" : "GET",
    credentials: "include",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/json", "X-Gluca-Request": "1" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (r.status === 401)
    throw new Error(
      "Sign in to Gluca before posting. Exporting still works without an account.",
    );
  if (!r.ok)
    throw new Error(
      r.status === 409
        ? "This export was already submitted or deleted. Start a new export to post different details."
        : r.status === 413 || r.status === 400
          ? "The image could not be uploaded. Try a smaller photo or check the audience."
          : "Gluca could not confirm the post. Retry publishing this same export safely.",
    );
  const b = await r.json();
  return body ? [b.post] : b.posts;
}
export async function deleteFeedPost(id: string) {
  const r = await fetch("/api/posts/delete", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Gluca-Request": "1" },
    body: JSON.stringify({ id }),
  });
  if (!r.ok)
    throw new Error("The post could not be deleted. Try again when connected.");
}
const listeners = new Set<(post: Post) => void>();
export function feedPublished(post: Post) {
  listeners.forEach((fn) => fn(post));
}
export function onFeedPublished(fn: (post: Post) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
