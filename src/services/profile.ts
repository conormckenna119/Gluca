import type { Profile, PrivacySettings } from "../domain/profile";
export type ProfileRecord = {
  profile: Profile;
  privacy: PrivacySettings;
  revision: number;
};
export async function profileRequest(
  data?: ProfileRecord,
): Promise<ProfileRecord | null> {
  const r = await fetch("/api/profile", {
    method: data ? "POST" : "GET",
    credentials: "include",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/json", "X-Gluca-Request": "1" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  if (r.status === 401 && !data) return null;
  const b = await r.json();
  if (!r.ok)
    throw new Error(
      (
        {
          profile_conflict:
            "Profile changed elsewhere. Reopen the editor before saving.",
          handle_unavailable: "That public username is taken.",
          invalid_profile: "Check your username, photo and diagnosis date.",
        } as Record<string, string>
      )[b.error] ??
        "Profile service unavailable. Your changes have not been saved.",
    );
  return b;
}
