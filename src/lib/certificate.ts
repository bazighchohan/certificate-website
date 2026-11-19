import "server-only";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

import { NAME_STYLES, TEMPLATE_FILE, type CertType, type NameStyle } from "@/lib/config";

const PUBLIC_DIR = path.join(process.cwd(), "public");

const fileCache = new Map<string, Promise<Uint8Array | null>>();

function readPublic(relPath: string): Promise<Uint8Array | null> {
  let p = fileCache.get(relPath);
  if (!p) {
    p = readFile(path.join(PUBLIC_DIR, relPath))
      .then((b) => new Uint8Array(b))
      .catch((err: NodeJS.ErrnoException) => {
        fileCache.delete(relPath);
        if (err.code === "ENOENT") return null;
        throw err;
      });
    fileCache.set(relPath, p);
  }
  return p;
}

async function loadFontBytes(fontFile: string): Promise<Uint8Array | null> {
  const configured = await readPublic(fontFile);
  if (configured) return configured;

  const files = await readdir(path.join(PUBLIC_DIR, "fonts")).catch(() => [] as string[]);
  const fallback = files.sort().find((f) => /\.(ttf|otf)$/i.test(f));
  return fallback ? readPublic(`fonts/${fallback}`) : null;
}

export interface RenderOverrides {
  nameY?: number;
  fontSize?: number;
  centerXRatio?: number;
}

/**
 * Returns a one-page PDF: the page for `certType` with `name` centred horizontally
 * on page.getWidth() * centerXRatio (defaulting to 0.665), sitting between the ribbon
 * and the divider line.
 */
export async function renderCertificate(
  certType: CertType,
  name: string,
  overrides: RenderOverrides = {},
): Promise<Uint8Array> {
  const style: NameStyle = { ...NAME_STYLES[certType], ...stripUndefined(overrides) };

  const templateBytes = await readPublic(TEMPLATE_FILE);
  if (!templateBytes) throw new Error(`Template not found: public/${TEMPLATE_FILE}`);

  const pdf = await PDFDocument.load(templateBytes);
  pdf.registerFontkit(fontkit);

  const pageCount = pdf.getPageCount();
  if (style.pageIndex < 0 || style.pageIndex >= pageCount) {
    throw new Error(`Template has ${pageCount} page(s); no page ${style.pageIndex + 1} for ${certType}.`);
  }

  // Keep only the page for this certificate type
  for (let i = pageCount - 1; i >= 0; i--) {
    if (i !== style.pageIndex) pdf.removePage(i);
  }
  const page = pdf.getPage(0);
  const { width: pageWidth } = page.getSize();

  // Content block center X (default: 66.5% of page width)
  const centerX = pageWidth * (style.centerXRatio ?? 0.665);

  // Maximum width for the name (e.g. 55% of page width to never touch diagonal shapes or edges)
  const maxAllowedWidth = pageWidth * (style.maxWidthRatio ?? 0.55);

  // Embed font with fontkit (falls back to Helvetica Bold if font file is missing)
  const fontBytes = await loadFontBytes(style.fontFile);
  const font: PDFFont = fontBytes
    ? await pdf.embedFont(fontBytes, { subset: true })
    : await pdf.embedFont(StandardFonts.HelveticaBold);

  // Auto-shrink font size if natural text width exceeds maxAllowedWidth
  let size = style.fontSize;
  const naturalWidth = font.widthOfTextAtSize(name, size);
  if (naturalWidth > maxAllowedWidth) {
    size = (size * maxAllowedWidth) / naturalWidth;
  }
  const textWidth = font.widthOfTextAtSize(name, size);

  // Center horizontally on centerX (centerX - textWidth / 2)
  const x = centerX - textWidth / 2;

  // Draw attendee name with dark navy color (#0B2A4F)
  page.drawText(name, {
    x,
    y: style.nameY,
    size,
    font,
    color: rgb(...style.color),
  });

  pdf.setTitle(`Certificate – ${name}`);
  return pdf.save();
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
