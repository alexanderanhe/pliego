import { z } from "zod";
export const metadataSchema = z.object({
  name: z.string().min(1).max(200),
  width: z.number().int().min(32).max(16000),
  height: z.number().int().min(32).max(16000),
  size: z
    .number()
    .int()
    .positive()
    .max(40 * 1024 * 1024),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const configSchema = z.object({
  paper: z.enum(["letter", "a4", "a3", "legal", "custom"]),
  customWidth: z.number().min(100).max(1000),
  customHeight: z.number().min(100).max(1000),
  orientation: z.enum(["portrait", "landscape"]),
  units: z.enum(["mm", "cm", "in"]),
  columns: z.number().int().min(1).max(200),
  rows: z.number().int().min(1).max(200),
  sizing: z.enum(["grid", "exact"]),
  width: z.number().positive().max(20000),
  height: z.number().positive().max(20000),
  margin: z.number().min(0).max(100),
  overlap: z.number().min(0).max(100),
  fit: z.enum(["contain", "cover", "manual"]),
  crop: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    zoom: z.number().min(1).max(5),
    rotation: z.number().min(-180).max(180).default(0),
  }),
  background: z.string().regex(/^(#[0-9a-fA-F]{6}|transparent)$/),
  effect: z.enum(["color", "grayscale", "threshold"]),
  guides: z.object({
    cuts: z.boolean(),
    joins: z.boolean(),
    labels: z.boolean(),
    numbers: z.boolean(),
    arrows: z.boolean(),
  }),
  calibration: z.number().min(0.8).max(1.2),
  calibrationEnabled: z.boolean(),
});
export type PosterConfig = z.infer<typeof configSchema>;
export type ImageMetadata = z.infer<typeof metadataSchema>;
export const DEFAULT_CONFIG: PosterConfig = {
  paper: "letter",
  customWidth: 210,
  customHeight: 297,
  orientation: "portrait",
  units: "cm",
  columns: 2,
  rows: 2,
  sizing: "grid",
  width: 402.8,
  height: 529.8,
  margin: 6,
  overlap: 5,
  fit: "contain",
  crop: { x: 0.5, y: 0.5, zoom: 1, rotation: 0 },
  background: "#ffffff",
  effect: "color",
  guides: {
    cuts: true,
    joins: true,
    labels: true,
    numbers: true,
    arrows: true,
  },
  calibration: 1,
  calibrationEnabled: false,
};
