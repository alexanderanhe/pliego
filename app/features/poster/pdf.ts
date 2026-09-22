import {
  PDFDocument,
  StandardFonts,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
  degrees,
} from "pdf-lib";
import {
  fitImage,
  imageToPdf,
  layout,
  mmToPoints as pt,
  type Size,
} from "./math";
import type { PosterConfig } from "./schema";
export function safeFilename(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .slice(0, 70) || "imagen"
  );
}
export async function generatePdf(
  bytes: Uint8Array,
  imageSize: Size,
  c: PosterConfig,
  options: { signal?: AbortSignal; onProgress?: (n: number) => void } = {},
) {
  const doc = await PDFDocument.create();
  doc.setTitle("Pliego · Póster");
  doc.setCreator("Pliego");
  const image = await doc.embedPng(bytes),
    font = await doc.embedFont(StandardFonts.Helvetica),
    l = layout(c),
    placed = fitImage(imageSize, l.poster, c.fit, c.crop);
  for (const tile of l.tiles) {
    options.signal?.throwIfAborted();
    const page = doc.addPage([pt(l.paper.width), pt(l.paper.height)]),
      f = l.factor;
    page.pushOperators(
      pushGraphicsState(),
      rectangle(
        pt(c.margin),
        pt(l.paper.height - c.margin - tile.height * f),
        pt(tile.width * f),
        pt(tile.height * f),
      ),
      clip(),
      endPath(),
    );
    if (c.background !== "transparent") {
      const hex = c.background.slice(1);
      page.drawRectangle({
        x: pt(c.margin),
        y: pt(l.paper.height - c.margin - tile.height * f),
        width: pt(tile.width * f),
        height: pt(tile.height * f),
        color: rgb(
          parseInt(hex.slice(0, 2), 16) / 255,
          parseInt(hex.slice(2, 4), 16) / 255,
          parseInt(hex.slice(4, 6), 16) / 255,
        ),
      });
    }
    page.drawImage(image, {
      ...imageToPdf(placed, tile, l.paper, c.margin, f),
      rotate: degrees(c.crop.rotation),
    });
    page.pushOperators(popGraphicsState());
    const line = (x: number, y: number, x2: number, y2: number, dash = false) =>
      page.drawLine({
        start: { x: pt(x), y: pt(l.paper.height - y) },
        end: { x: pt(x2), y: pt(l.paper.height - y2) },
        thickness: 0.35,
        color: rgb(0.28, 0.32, 0.4),
        ...(dash ? { dashArray: [2, 2] } : {}),
      });
    const x = c.margin,
      y = c.margin,
      w = tile.width * f,
      h = tile.height * f;
    if (c.guides.cuts)
      for (const [cx, cy] of [
        [x, y],
        [x + w, y],
        [x, y + h],
        [x + w, y + h],
      ]) {
        line(Math.max(0, cx - 2), cy, Math.min(l.paper.width, cx + 2), cy);
        line(cx, Math.max(0, cy - 2), cx, Math.min(l.paper.height, cy + 2));
      }
    if (c.guides.joins && tile.column > 0)
      line(x + c.overlap * f, y, x + c.overlap * f, y + h, true);
    if (c.guides.joins && tile.row > 0)
      line(x, y + c.overlap * f, x + w, y + c.overlap * f, true);
    const text = [
      c.guides.labels ? `${tile.id} (${tile.row + 1},${tile.column + 1})` : "",
      c.guides.numbers ? `${tile.index + 1}/${l.tiles.length}` : "",
      c.guides.arrows ? "^ ARRIBA" : "",
    ]
      .filter(Boolean)
      .join("  |  ");
    if (text && c.margin >= 3)
      page.drawText(text, {
        x: pt(c.margin),
        y: pt(Math.max(0.8, c.margin / 2 - 1)),
        size: 6,
        font,
        color: rgb(0.2, 0.25, 0.35),
      });
    options.onProgress?.((tile.index + 1) / l.tiles.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  options.signal?.throwIfAborted();
  const bytesOut = await doc.save();
  options.signal?.throwIfAborted();
  return bytesOut;
}
export async function calibrationPdf() {
  const doc = await PDFDocument.create(),
    p = doc.addPage([612, 792]),
    font = await doc.embedFont(StandardFonts.Helvetica);
  p.drawText("PLIEGO / CALIBRACION", { x: pt(20), y: pt(255), size: 18, font });
  p.drawText("Imprime al 100 %. Desactiva Ajustar a pagina.", {
    x: pt(20),
    y: pt(241),
    size: 11,
    font,
  });
  p.drawRectangle({
    x: pt(30),
    y: pt(110),
    width: pt(100),
    height: pt(100),
    borderWidth: 0.5,
    borderColor: rgb(0, 0, 0),
  });
  p.drawText("100 x 100 mm", { x: pt(60), y: pt(155), font, size: 12 });
  for (let i = 0; i <= 100; i++) {
    const length = i % 10 === 0 ? 5 : i % 5 === 0 ? 3 : 1.5;
    p.drawLine({
      start: { x: pt(30 + i), y: pt(100) },
      end: { x: pt(30 + i), y: pt(100 - length) },
      thickness: 0.4,
    });
    p.drawLine({
      start: { x: pt(20), y: pt(110 + i) },
      end: { x: pt(20 - length), y: pt(110 + i) },
      thickness: 0.4,
    });
    if (i % 10 === 0)
      p.drawText(String(i), { x: pt(29 + i), y: pt(90), size: 6, font });
  }
  p.drawText("Mide entre los centros de las lineas del cuadrado.", {
    x: pt(20),
    y: pt(70),
    size: 10,
    font,
  });
  p.drawText("Ancho real: __________ mm     Alto real: __________ mm", {
    x: pt(20),
    y: pt(60),
    size: 10,
    font,
  });
  return doc.save();
}
