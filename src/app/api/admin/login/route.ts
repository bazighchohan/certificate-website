import "server-only";

import { NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionSecret,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = getSessionSecret();
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfiguration: SESSION_SECRET is not configured or too short." },
      { status: 500 }
    );
  }

  if (!expectedPassword) {
    return NextResponse.json(
      { error: "Server misconfiguration: ADMIN_PASSWORD is not set." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { password } = (body ?? {}) as { password?: unknown };
  if (typeof password !== "string" || password !== expectedPassword) {
    return NextResponse.json({ error: "Invalid admin password." }, { status: 401 });
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
