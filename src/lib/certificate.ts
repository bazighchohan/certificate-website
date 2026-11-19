import "server-only";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

import { NAME_STYLES, TEMPLATE_FILE, type CertType, type NameStyle } from "@/lib/config";

const PUBLIC_DIR = path.join(process.cwd(), "public");

// Template and fonts are read once per server instance.
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

/** Configured font → first .ttf/.otf in public/fonts → null (use Helvetica). */
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
}

/**
 * Returns a one-page PDF: the page for `certType` with `name` centred on it.
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

  // Keep only the page for this certificate type (remove from the end so indices stay valid).
  for (let i = pageCount - 1; i >= 0; i--) {
    if (i !== style.pageIndex) pdf.removePage(i);
  }
  const page = pdf.getPage(0);

  const fontBytes = await loadFontBytes(style.fontFile);
  const font: PDFFont = fontBytes
    ? await pdf.embedFont(fontBytes, { subset: true })
    : await pdf.embedFont(StandardFonts.HelveticaBold);

  // Auto-shrink to fit maxWidth.
  let size = style.fontSize;
  const naturalWidth = font.widthOfTextAtSize(name, size);
  if (naturalWidth > style.maxWidth) size = (size * style.maxWidth) / naturalWidth;
  const textWidth = font.widthOfTextAtSize(name, size);

  page.drawText(name, {
    x: (page.getWidth() - textWidth) / 2,
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
