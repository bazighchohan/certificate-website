// Stateless signed admin session (HMAC-SHA256 via Web Crypto).
// Used by both proxy.ts and route handlers, so it must not import "server-only"
// or Node-only modules.
//
// Token format: v1.<expiresAtMs>.<nonce>.<signature>   (base64url signature)

export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE_SEC = 8 * 60 * 60; // 8 hours

const enc = new TextEncoder();

/** Returns the secret, or null if missing/too short (fail closed). */
export function getSessionSecret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) throw new Error("SESSION_SECRET must be set and at least 32 characters.");
  const exp = Date.now() + SESSION_MAX_AGE_SEC * 1000;
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const payload = `v1.${exp}.${nonce}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payload));
  return `${payload}.${b64url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  const secret = getSessionSecret();
  if (!secret || !token) return false;

  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return false;
  const [, expStr, nonce, sigStr] = parts;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;

  const sig = fromB64url(sigStr);
  if (!sig) return false;

  // crypto.subtle.verify is constant-time.
  return crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    sig,
    enc.encode(`v1.${expStr}.${nonce}`),
  );
}
