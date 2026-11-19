import "server-only";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";

import { APP_URL, NAME_STYLES, TEMPLATE_FILE, type CertType, type NameStyle } from "@/lib/config";

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
  certId?: string;
}

/**
 * Returns a one-page PDF: the page for `certType` with `name` centred on it,
 * along with a QR code and cert_id at the bottom corner pointing to /verify/<cert_id>.
 */
export async function renderCertificate(
  certType: CertType,
  name: string,
  certId: string,
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

  const fontBytes = await loadFontBytes(style.fontFile);
  const font: PDFFont = fontBytes
    ? await pdf.embedFont(fontBytes, { subset: true })
    : await pdf.embedFont(StandardFonts.HelveticaBold);

  const monoFont = await pdf.embedFont(StandardFonts.Helvetica);

  // Auto-shrink name to fit maxWidth
  let size = style.fontSize;
  const naturalWidth = font.widthOfTextAtSize(name, size);
  if (naturalWidth > style.maxWidth) size = (size * style.maxWidth) / naturalWidth;
  const textWidth = font.widthOfTextAtSize(name, size);

  // Draw attendee name
  page.drawText(name, {
    x: (pageWidth - textWidth) / 2,
    y: style.nameY,
    size,
    font,
    color: rgb(...style.color),
  });

  // Generate QR code pointing to /verify/<cert_id>
  if (certId) {
    const cleanBase = APP_URL.replace(/\/+$/, "");
    const verifyUrl = `${cleanBase}/verify/${encodeURIComponent(certId)}`;

    // Generate PNG buffer of QR code
    const qrPngBuffer = await QRCode.toBuffer(verifyUrl, {
      type: "png",
      width: 140,
      margin: 1,
      color: {
        dark: "#1e293b", // Slate 800
        light: "#ffffff",
      },
    });

    const qrImage = await pdf.embedPng(qrPngBuffer);
    const qrDim = 46; // 46pt square
    const margin = 28; // 28pt from bottom-right corner

    const qrX = pageWidth - margin - qrDim;
    const qrY = margin + 10;

    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrDim,
      height: qrDim,
    });

    // Draw cert_id label directly underneath QR code
    const label = `ID: ${certId}`;
    const labelSize = 7;
    const labelWidth = monoFont.widthOfTextAtSize(label, labelSize);

    page.drawText(label, {
      x: qrX + (qrDim - labelWidth) / 2,
      y: qrY - 8,
      size: labelSize,
      font: monoFont,
      color: rgb(0.35, 0.4, 0.45),
    });
  }

  pdf.setTitle(`Certificate – ${name}`);
  return pdf.save();
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}
