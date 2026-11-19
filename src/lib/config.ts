/** Site-wide display settings (server-side). Override via env vars. */
export const SEMINAR_TITLE =
  process.env.SEMINAR_TITLE ?? "National Seminar 2026";

export const SEMINAR_SUBTITLE =
  process.env.SEMINAR_SUBTITLE ?? "E-Certificate Portal";

/** Base public URL used for generating QR code links. */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

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
  /**
   * TTF/OTF font, relative to /public. If missing, the first .ttf/.otf found in
   * public/fonts/ is used; if there is none, Helvetica Bold (Latin-only).
   */
  fontFile: string;
  /** Starting font size in points (auto-shrinks to fit maxWidth). */
  fontSize: number;
  /** Baseline of the name, in points from the BOTTOM of the page. */
  nameY: number;
  /** Max name width in points before the font is shrunk. */
  maxWidth: number;
  /** RGB, 0–1. */
  color: [number, number, number];
}

// Pages are 843.75 × 597.75 pt. Tune with /api/preview in development.
export const NAME_STYLES: Record<CertType, NameStyle> = {
  participation: {
    pageIndex: 0,
    fontFile: "fonts/name.ttf",
    fontSize: 36,
    nameY: 290,
    maxWidth: 600,
    color: [0.1, 0.1, 0.1],
  },
  appreciation: {
    pageIndex: 1,
    fontFile: "fonts/name.ttf",
    fontSize: 36,
    nameY: 290,
    maxWidth: 600,
    color: [0.1, 0.1, 0.1],
  },
};
