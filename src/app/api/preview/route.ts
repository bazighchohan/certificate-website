import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { renderCertificate } from "@/lib/certificate";
import { CERT_TYPES, isCertType } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DEV ONLY — tune and inspect name placement on certificates.
 *   /api/preview?type=participation&name=Bazigh%20Ali
 * Optional overrides for tuning without editing config.ts:
 *   &y=265        baseline Y in points from bottom (default: 265)
 *   &size=34      starting font size (default: 34)
 *   &cx=0.665     centerX ratio (default: 0.665)
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
  const name = (params.get("name") ?? "Bazigh Ali").trim().replace(/\s+/g, " ").slice(0, 120) || "Bazigh Ali";

  const num = (key: string) => {
    const raw = params.get(key);
    if (raw === null || raw === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };

  try {
    const pdf = await renderCertificate(type, name, {
      nameY: num("y"),
      fontSize: num("size"),
      centerXRatio: num("cx"),
    });

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
