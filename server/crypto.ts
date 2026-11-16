// Small crypto helpers built on node:crypto only.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export function sha256hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext>, all base64url. Key must be 32 bytes. */
export function encrypt(plain: string, key: Buffer, context?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (context) cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    context ? "v2" : "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    data.toString("base64url"),
  ].join(".");
}

export function decrypt(
  payload: string,
  key: Buffer,
  context?: string,
): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || !["v1", "v2"].includes(parts[0]))
    throw new Error("Unsupported ciphertext format");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(parts[1], "base64url"),
  );
  decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
  if (parts[0] === "v2") {
    if (!context) throw new Error("Ciphertext context required");
    decipher.setAAD(Buffer.from(context));
  }
  return Buffer.concat([
    decipher.update(Buffer.from(parts[3], "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Returns `<value>.<hmac>`. */
export function signValue(value: string, secret: string): string {
  return `${value}.${createHmac("sha256", secret).update(value).digest("base64url")}`;
}

/** Returns the original value when the signature is valid, otherwise null. */
export function verifySigned(signed: string, secret: string): string | null {
  const i = signed.lastIndexOf(".");
  if (i < 1) return null;
  const value = signed.slice(0, i);
  const expected = signValue(value, secret);
  return safeEqual(signed, expected) ? value : null;
}
