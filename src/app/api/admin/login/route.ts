import "server-only";

import { NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionSecret,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
} from "@/lib/session";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 5 requests per minute per IP for admin login
const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_MS = 60_000;

export async function POST(req: Request) {
  // 1. Rate limiting
  const ip = clientIp(req);
  const rl = rateLimit(`admin-login:${ip}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a minute and try again." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rl.retryAfterSec),
        },
      }
    );
  }

  const secret = getSessionSecret();
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!secret) {
    return NextResponse.json(
      { error: "Authentication service unavailable." },
      { status: 500 }
    );
  }

  if (!expectedPassword) {
    return NextResponse.json(
      { error: "Authentication service unavailable." },
      { status: 500 }
    );
  }

  // 2. Input validation
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 400 });
  }

  const { password } = (body ?? {}) as { password?: unknown };
  if (typeof password !== "string" || !password.trim()) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 400 });
  }

  // 3. Password comparison
  if (password !== expectedPassword) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = await createSessionToken();
  const isProd = process.env.NODE_ENV === "production";

  const res = NextResponse.json({ ok: true, message: "Logged in successfully." });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });

  return res;
}
