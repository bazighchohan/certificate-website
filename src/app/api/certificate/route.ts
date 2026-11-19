import "server-only";

import { NextResponse } from "next/server";

import { renderCertificate } from "@/lib/certificate";
import { isCertType, type CertType } from "@/lib/config";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getReleased, getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 5 requests per minute per IP
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

const MSG_BAD_INPUT = "Please enter a valid roll number and full name.";
const MSG_NOT_FOUND = "Not found, check your details.";

type Attendee = { id: string; roll_no: string; name: string; cert_type: CertType; cert_id: string };

const normalizeRollNo = (v: string) => v.trim().toUpperCase();
const normalizeName = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();

function fail(
  status: number,
  code: string,
  error: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return NextResponse.json(
    { error, code, ...extra },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

export async function POST(req: Request) {
  // 1. Rate limit: 5 requests / minute / IP
  const rl = rateLimit(`cert:${clientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.ok) {
    return fail(
      429,
      "RATE_LIMITED",
      "Too many attempts. Please wait a minute and try again.",
      {},
      { "Retry-After": String(rl.retryAfterSec) },
    );
  }

  // 2. Validate input
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "BAD_REQUEST", MSG_BAD_INPUT);
  }
  const { rollNo, name, certType } = (body ?? {}) as Record<string, unknown>;
  if (typeof rollNo !== "string" || typeof name !== "string") {
    return fail(400, "BAD_REQUEST", MSG_BAD_INPUT);
  }
  if (certType !== undefined && certType !== null && !isCertType(certType)) {
    return fail(400, "BAD_REQUEST", "Invalid certificate type.");
  }
  const roll = normalizeRollNo(rollNo);
  const inputName = normalizeName(name);
  if (!roll || !inputName || roll.length > 50 || inputName.length > 120) {
    return fail(400, "BAD_REQUEST", MSG_BAD_INPUT);
  }
  const requestedType = isCertType(certType) ? certType : undefined;

  try {
    // 3. Release gate
    if (!(await getReleased())) {
      return fail(403, "NOT_RELEASED", "Certificates will be available soon.");
    }

    // 4. Look up by roll no (service role; server only)
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("attendees")
      .select("id, roll_no, name, cert_type, cert_id")
      .eq("roll_no", roll);
    if (error) throw error;

    // 5. Name must match after normalisation (generic 404 either way)
    const matches = ((data ?? []) as Attendee[]).filter(
      (a) => normalizeName(a.name) === inputName,
    );
    if (matches.length === 0) return fail(404, "NOT_FOUND", MSG_NOT_FOUND);

    // 6. Choose certificate
    let attendee: Attendee | undefined;
    if (requestedType) {
      attendee = matches.find((a) => a.cert_type === requestedType);
      if (!attendee) return fail(404, "NOT_FOUND", MSG_NOT_FOUND);
    } else if (matches.length === 1) {
      attendee = matches[0];
    } else {
      return fail(409, "CHOOSE_TYPE", "You have more than one certificate. Please choose one.", {
        options: matches.map((a) => a.cert_type),
      });
    }

    // 7. Render one-page PDF with stored spelling
    const displayName = attendee.name.trim().replace(/\s+/g, " ");
    const pdfBytes = await renderCertificate(attendee.cert_type, displayName);

    // 8. Increment download_count atomically
    const { error: rpcError } = await supabase.rpc("increment_download_count", {
      attendee_id: attendee.id,
    });
    if (rpcError) console.error("Failed to increment download_count:", rpcError);

    // 9. Return attachment
    const safeRoll = roll.replace(/[^A-Z0-9_-]/g, "_");
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificate-${safeRoll}.pdf"`,
        "Content-Length": String(pdfBytes.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Certificate request failed:", err);
    return fail(500, "SERVER_ERROR", "Something went wrong on our side. Please try again in a moment.");
  }
}
