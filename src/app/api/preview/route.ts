import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { renderCertificate } from "@/lib/certificate";
import { CERT_TYPES, isCertType } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DEV ONLY — tune name placement.
 *   /api/preview?type=participation&name=Test%20Name
 * Optional overrides (without editing config.ts):
 *   &y=300     baseline Y in points from the bottom
 *   &size=40   starting font size
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const params = req.nextUrl.searchParams;
  const type = params.get("type") ?? "participation";
  if (!isCertType(type)) {
    return NextResponse.json(
      { error: `type must be one of: ${CERT_TYPES.join(", ")}`, code: "BAD_REQUEST" },
      { status: 400 },
    );
  }
  const name = (params.get("name") ?? "Test Name").trim().replace(/\s+/g, " ").slice(0, 120) || "Test Name";
  const num = (key: string) => {
    const raw = params.get(key);
    if (raw === null || raw === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };

  try {
    const pdf = await renderCertificate(type, name, "DEMO-12345", { nameY: num("y"), fontSize: num("size") });
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="preview-${type}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err), code: "SERVER_ERROR" },
      { status: 500 },
    );
  }
}
