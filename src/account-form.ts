// Pure rules for the account form. They mirror server/session.ts: usernames 3 to 40 of letters,
// digits, "_", "." and "-" (stored lower-case); passphrases 12 to 128 characters.
export type AccountMode = "signIn" | "create";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 40;
export const PASSPHRASE_MIN = 12;
export const PASSPHRASE_MAX = 128;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,40}$/;

export const normalizeUsername = (u: string) => u.trim().toLowerCase();

export function validateUsername(u: string): string | null {
  const n = u.trim();
  if (!n) return "Enter a username.";
  if (n.length < USERNAME_MIN) return "Use at least 3 characters.";
  if (n.length > USERNAME_MAX) return "Use 40 characters or fewer.";
  if (!USERNAME_RE.test(n))
    return "Use only letters, numbers, dots, dashes and underscores.";
  return null;
}

export function validatePassphrase(p: string, username = ""): string | null {
  if (!p) return "Enter a passphrase.";
  if (p.length < PASSPHRASE_MIN)
    return "Use at least 12 characters. A few unrelated words works well.";
  if (p.length > PASSPHRASE_MAX) return "Use 128 characters or fewer.";
  const u = normalizeUsername(username);
  if (u && p.trim().toLowerCase() === u)
    return "Your passphrase cannot be the same as your username.";
  return null;
}

export function validateConfirm(p: string, confirm: string): string | null {
  if (!confirm) return "Type the passphrase again.";
  return p === confirm ? null : "The two passphrases do not match.";
}

export function passphraseHint(length: number): string {
  if (length >= PASSPHRASE_MIN) return "Long enough";
  const n = PASSPHRASE_MIN - length;
  return `${n} more character${n === 1 ? "" : "s"}`;
}

export type AccountFields = {
  username: string;
  passphrase: string;
  confirm?: string;
  ageConfirmed?: boolean;
};

export function canSubmit(mode: AccountMode, f: AccountFields): boolean {
  if (mode === "signIn")
    return validateUsername(f.username) === null && f.passphrase.length > 0;
  return (
    validateUsername(f.username) === null &&
    validatePassphrase(f.passphrase, f.username) === null &&
    validateConfirm(f.passphrase, f.confirm ?? "") === null &&
    f.ageConfirmed === true
  );
}

export const NOT_RUNNING =
  "The account server is not running, so accounts are not available right now. You can keep using the app without one.";

/** One plain sentence per error code. `mode` is kept so wording can differ later; sign-in never reveals whether a name exists. */
export function messageFor(code: string, _mode: AccountMode): string {
  switch (code) {
    case "invalid_login":
    case "no_session":
      return "The username or passphrase is not right.";
    case "invalid_credentials":
      return "Use a username of 3 to 40 characters and a passphrase of 12 to 128 characters.";
    case "account_unavailable":
      return "That username is taken. Try another.";
    case "rate_limited":
      return "Too many tries. Wait a minute and try again.";
    case "dexcom_not_configured":
      return "The account server is not set up yet. You can keep using the app without an account.";
    default:
      return NOT_RUNNING;
  }
}
