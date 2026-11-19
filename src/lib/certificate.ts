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
 * Returns a one-page PDF:
 * 1. Picks the exact template page object by type (participation = 0, appreciation = 1).
 * 2. Draws the name centered at (page.getWidth() * centerXRatio) and nameY directly onto that page.
 * 3. Removes all other pages only AFTER drawing, so the target page object is never missed.
 * 4. Logs exact dimensions, coordinates, and font sizes to the console.
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

  const pages = pdf.getPages();
  const pageCount = pages.length;

  if (style.pageIndex < 0 || style.pageIndex >= pageCount) {
    throw new Error(
      `Template has ${pageCount} page(s); configured pageIndex ${style.pageIndex} for '${certType}' does not exist.`
    );
  }

  // 1. Pick the exact target page object by certificate type BEFORE removing any pages
  const targetPage = pages[style.pageIndex];
  const { width: pageWidth, height: pageHeight } = targetPage.getSize();

  // Content block horizontal center (default: 66.5% of canvas width)
  const centerX = pageWidth * (style.centerXRatio ?? 0.665);

  // Maximum width boundary (default: 55% of canvas width)
  const maxAllowedWidth = pageWidth * (style.maxWidthRatio ?? 0.55);

  // Load font
  const fontBytes = await loadFontBytes(style.fontFile);
  const font: PDFFont = fontBytes
    ? await pdf.embedFont(fontBytes, { subset: true })
    : await pdf.embedFont(StandardFonts.HelveticaBold);

  // Calculate font size (auto-shrink if natural width exceeds maximum)
  let size = style.fontSize;
  const naturalWidth = font.widthOfTextAtSize(name, size);
  if (naturalWidth > maxAllowedWidth) {
    size = (size * maxAllowedWidth) / naturalWidth;
  }
  const textWidth = font.widthOfTextAtSize(name, size);

  // Calculate X (centered on centerX)
  const textX = centerX - textWidth / 2;
  const textY = style.nameY;

  // Server log for verification
  console.log(
    `[renderCertificate] type="${certType}" pageIndex=${style.pageIndex} ` +
      `pageSize=${pageWidth.toFixed(2)}x${pageHeight.toFixed(2)} ` +
      `textX=${textX.toFixed(2)} textY=${textY.toFixed(2)} ` +
      `fontSize=${size.toFixed(2)} naturalWidth=${naturalWidth.toFixed(2)} textWidth=${textWidth.toFixed(2)} ` +
      `name="${name}"`
  );

  // 2. Draw the name on that exact target page object
  targetPage.drawText(name, {
    x: textX,
    y: textY,
    size,
    font,
    color: rgb(...style.color),
  });

  // 3. Remove all other pages only AFTER drawing is complete
  for (let i = pageCount - 1; i >= 0; i--) {
    if (i !== style.pageIndex) {
      pdf.removePage(i);
    }
  }

  pdf.setTitle(`Certificate – ${name}`);
  return pdf.save();
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
