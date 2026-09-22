import type { PosterConfig } from "./schema";
export type Size = { width: number; height: number };
export type Rect = Size & { x: number; y: number };
export const PAPERS = {
  letter: { width: 215.9, height: 279.4, label: "Carta" },
  a4: { width: 210, height: 297, label: "A4" },
  a3: { width: 297, height: 420, label: "A3" },
  legal: { width: 215.9, height: 355.6, label: "Oficio / Legal" },
};
export const mmToPoints = (mm: number) => (mm * 72) / 25.4;
export const pointsToMm = (pt: number) => (pt * 25.4) / 72;
export const toMm = (n: number, unit: PosterConfig["units"]) =>
  n * (unit === "in" ? 25.4 : unit === "cm" ? 10 : 1);
export const fromMm = (n: number, unit: PosterConfig["units"]) =>
  n / (unit === "in" ? 25.4 : unit === "cm" ? 10 : 1);
export function paperSize(c: PosterConfig): Size {
  const p =
    c.paper === "custom"
      ? { width: c.customWidth, height: c.customHeight }
      : PAPERS[c.paper];
  return c.orientation === "landscape"
    ? { width: p.height, height: p.width }
    : { width: p.width, height: p.height };
}
export function printableArea(p: Size, margin: number): Size {
  const s = { width: p.width - 2 * margin, height: p.height - 2 * margin };
  if (s.width <= 0 || s.height <= 0)
    throw new Error("Los márgenes no dejan área imprimible.");
  return s;
}
export function gridSize(
  cols: number,
  rows: number,
  area: Size,
  overlap: number,
): Size {
  return {
    width: area.width + (cols - 1) * (area.width - overlap),
    height: area.height + (rows - 1) * (area.height - overlap),
  };
}
export function gridForSize(size: Size, area: Size, overlap: number) {
  return {
    columns: Math.max(
      1,
      Math.ceil((size.width - overlap) / (area.width - overlap) - 1e-12),
    ),
    rows: Math.max(
      1,
      Math.ceil((size.height - overlap) / (area.height - overlap) - 1e-12),
    ),
  };
}
export function pageId(row: number, col: number) {
  let letters = "";
  let n = row + 1;
  while (n > 0) {
    n--;
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26);
  }
  return `${letters}${col + 1}`;
}
export function fitImage(
  image: Size,
  frame: Size,
  fit: PosterConfig["fit"],
  crop: PosterConfig["crop"],
): Rect {
  const scale =
    (fit === "contain"
      ? Math.min(frame.width / image.width, frame.height / image.height)
      : Math.max(frame.width / image.width, frame.height / image.height)) *
    (fit === "manual" ? crop.zoom : 1);
  const width = image.width * scale,
    height = image.height * scale;
  return {
    x: (frame.width - width) * crop.x,
    y: (frame.height - height) * crop.y,
    width,
    height,
  };
}
export const effectiveDpi = (image: Size, placed: Size) =>
  Math.min(image.width / placed.width, image.height / placed.height) * 25.4;
export const qualityLabel = (dpi: number) =>
  dpi >= 200
    ? "Excelente"
    : dpi >= 150
      ? "Buena"
      : dpi >= 100
        ? "Aceptable a distancia"
        : "Baja";
export type Tile = Rect & {
  row: number;
  column: number;
  id: string;
  index: number;
};
export function layout(c: PosterConfig) {
  const paper = paperSize(c),
    physical = printableArea(paper, c.margin),
    factor = c.calibrationEnabled ? c.calibration : 1;
  const area = {
    width: physical.width / factor,
    height: physical.height / factor,
  };
  if (c.overlap >= Math.min(area.width, area.height))
    throw new Error("El solapamiento debe ser menor que el área útil.");
  const poster =
    c.sizing === "grid"
      ? gridSize(c.columns, c.rows, area, c.overlap)
      : { width: c.width, height: c.height };
  const grid =
    c.sizing === "grid"
      ? { columns: c.columns, rows: c.rows }
      : gridForSize(poster, area, c.overlap);
  if (grid.columns * grid.rows > 200)
    throw new Error("El póster supera el máximo de 200 hojas.");
  const tiles: Tile[] = [];
  for (let row = 0; row < grid.rows; row++)
    for (let column = 0; column < grid.columns; column++) {
      const x = column * (area.width - c.overlap),
        y = row * (area.height - c.overlap);
      tiles.push({
        x,
        y,
        width: Math.min(area.width, poster.width - x),
        height: Math.min(area.height, poster.height - y),
        row,
        column,
        id: pageId(row, column),
        index: tiles.length,
      });
    }
  return { paper, area, physical, poster, ...grid, tiles, factor };
}
export function sourceCrop(tile: Rect, placed: Rect, image: Size): Rect {
  const x = Math.max(tile.x, placed.x),
    y = Math.max(tile.y, placed.y),
    right = Math.min(tile.x + tile.width, placed.x + placed.width),
    bottom = Math.min(tile.y + tile.height, placed.y + placed.height);
  return {
    x: ((x - placed.x) * image.width) / placed.width,
    y: ((y - placed.y) * image.height) / placed.height,
    width: (Math.max(0, right - x) * image.width) / placed.width,
    height: (Math.max(0, bottom - y) * image.height) / placed.height,
  };
}
export function imageToPdf(
  placed: Rect,
  tile: Rect,
  paper: Size,
  margin: number,
  factor = 1,
): Rect {
  return {
    x: mmToPoints(margin + (placed.x - tile.x) * factor),
    y: mmToPoints(
      paper.height - margin - (placed.y - tile.y + placed.height) * factor,
    ),
    width: mmToPoints(placed.width * factor),
    height: mmToPoints(placed.height * factor),
  };
}
export function calibrationFactor(width: number, height: number) {
  if (width < 83.34 || width > 125 || height < 83.34 || height > 125)
    throw new Error("Introduce medidas entre 83.34 y 125 mm.");
  return 200 / (width + height);
}
