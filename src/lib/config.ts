/** Site-wide display settings (server-side). Override via env vars. */
export const SEMINAR_TITLE =
  process.env.SEMINAR_TITLE ?? "National Seminar 2026";

export const SEMINAR_SUBTITLE =
  process.env.SEMINAR_SUBTITLE ?? "E-Certificate Portal";

/** Homepage footer credits and contact lines. */
export const FOOTER_HELP_TEXT =
  process.env.FOOTER_HELP_TEXT ?? "Having trouble? Contact the seminar organisers";

export const FOOTER_CREDIT_TEXT =
  process.env.FOOTER_CREDIT_TEXT ?? "Developed by Bazigh Ali, Executive Coordinator";

// ---------------------------------------------------------------------------
// Certificate template
// ---------------------------------------------------------------------------

/** Single 2-page landscape template, relative to /public. */
export const TEMPLATE_FILE = "template.pdf";

import type { CertType } from "@/lib/cert-types";
export { CERT_TYPES, CERT_LABELS, isCertType, type CertType } from "@/lib/cert-types";

export interface NameStyle {
  /** Zero-based page index in TEMPLATE_FILE. */
  pageIndex: number;
  /** Horizontal center ratio of the page (content block is centered around 66.5% width). */
  centerXRatio: number;
  /** Max width ratio relative to total page width (e.g. 0.55 = 55%). */
  maxWidthRatio: number;
  /**
   * TTF/OTF font, relative to /public. Embedded with fontkit.
   */
  fontFile: string;
  /** Starting font size in points (auto-shrinks to fit maxWidth). */
  fontSize: number;
  /** Baseline of the name, in points from the BOTTOM of the page. */
  nameY: number;
  /** RGB text color: [R, G, B] normalized 0–1. Dark navy #0B2A4F is [11/255, 42/255, 79/255]. */
  color: [number, number, number];
}

// Pages are 843.75 × 597.75 pt.
// Dark navy #0B2A4F matches "CERTIFICATE" header:
// R = 11/255 ≈ 0.0431, G = 42/255 ≈ 0.1647, B = 79/255 ≈ 0.3098
export const NAME_STYLES: Record<CertType, NameStyle> = {
  participation: {
    pageIndex: 0,
    centerXRatio: 0.665,
    maxWidthRatio: 0.55,
    fontFile: "fonts/TimesNewRoman-Bold.ttf",
    fontSize: 34,
    nameY: 265, // Lowered 25pt from 290pt to sit between ribbon and line
    color: [11 / 255, 42 / 255, 79 / 255],
  },
  appreciation: {
    pageIndex: 1,
    centerXRatio: 0.665,
    maxWidthRatio: 0.55,
    fontFile: "fonts/TimesNewRoman-Bold.ttf",
    fontSize: 34,
    nameY: 265, // Lowered 25pt from 290pt to sit between ribbon and line
    color: [11 / 255, 42 / 255, 79 / 255],
  },
};
