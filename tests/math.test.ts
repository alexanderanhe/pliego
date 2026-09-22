import { describe, expect, it } from "vitest";
import {
  PAPERS,
  calibrationFactor,
  effectiveDpi,
  fitImage,
  gridForSize,
  gridSize,
  imageToPdf,
  layout,
  mmToPoints,
  pageId,
  printableArea,
  sourceCrop,
  toMm,
} from "../app/features/poster/math";
import { DEFAULT_CONFIG } from "../app/features/poster/schema";
import { PLAN_LIMITS, activePlan, canUseFeature } from "../app/lib/product";

describe("medidas y precisión de impresión", () => {
  it("convierte unidades físicas sin redondear", () => {
    expect(mmToPoints(25.4)).toBe(72);
    expect(toMm(1, "in")).toBe(25.4);
    expect(toMm(2, "cm")).toBe(20);
  });
  it("conoce tamaños de papel", () => {
    expect(PAPERS.letter).toEqual({
      width: 215.9,
      height: 279.4,
      label: "Carta",
    });
    expect(mmToPoints(PAPERS.letter.width)).toBeCloseTo(612);
    expect(mmToPoints(PAPERS.a4.height)).toBeCloseTo(841.89, 2);
  });
  it("calcula área imprimible", () => {
    expect(printableArea(PAPERS.letter, 6)).toEqual({
      width: 203.9,
      height: 267.4,
    });
    expect(() => printableArea({ width: 10, height: 10 }, 6)).toThrow();
  });
  it("divide una cuadrícula con solapamiento", () => {
    const area = { width: 203.9, height: 267.4 };
    expect(gridSize(2, 2, area, 5)).toEqual({ width: 402.8, height: 529.8 });
    expect(gridForSize({ width: 402.8, height: 529.8 }, area, 5)).toEqual({
      columns: 2,
      rows: 2,
    });
  });
  it("mantiene límites contiguos sin huecos", () => {
    const c = { ...DEFAULT_CONFIG, columns: 3, rows: 2 };
    const l = layout(c);
    expect(l.tiles[0].x + l.tiles[0].width - l.tiles[1].x).toBe(c.overlap);
    const last = l.tiles[l.tiles.length - 1];
    expect(last.x + last.width).toBeCloseTo(l.poster.width);
  });
  it("preserva proporción y calcula recorte", () => {
    const placed = fitImage(
      { width: 2000, height: 1000 },
      { width: 400, height: 400 },
      "contain",
      DEFAULT_CONFIG.crop,
    );
    expect(placed.width / placed.height).toBe(2);
    const crop = sourceCrop(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 400, height: 200 },
      { width: 2000, height: 1000 },
    );
    expect(crop).toEqual({ x: 0, y: 0, width: 500, height: 500 });
  });
  it("transforma a puntos PDF con papel carta", () => {
    const r = imageToPdf(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 100, height: 100 },
      PAPERS.letter,
      6,
    );
    expect(r.x).toBeCloseTo(mmToPoints(6));
    expect(r.y).toBeCloseTo(mmToPoints(PAPERS.letter.height - 106));
  });
  it("estima DPI y etiquetas de página", () => {
    expect(
      effectiveDpi({ width: 2000, height: 2000 }, { width: 254, height: 254 }),
    ).toBeCloseTo(200);
    expect(pageId(0, 0)).toBe("A1");
    expect(pageId(26, 2)).toBe("AA3");
  });
  it("calcula calibración", () => {
    expect(calibrationFactor(102, 98)).toBe(1);
    expect(() => calibrationFactor(80, 100)).toThrow();
  });
});
describe("planes y capacidades", () => {
  it("centraliza límites", () => {
    expect(PLAN_LIMITS.guest.maxPages).toBe(12);
    expect(activePlan(null)).toBe("guest");
    expect(activePlan({ plan: "free", planStatus: "active" })).toBe("free");
    expect(canUseFeature(null, "save_projects")).toBe(false);
    expect(
      canUseFeature({ plan: "free", planStatus: "active" }, "save_projects"),
    ).toBe(true);
  });
});
