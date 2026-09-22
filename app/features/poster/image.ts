import type { ImageMetadata, PosterConfig } from "./schema";
export const IMAGE_LIMITS = {
  maxBytes: 40 * 1024 * 1024,
  maxPixels: 40_000_000,
  minDimension: 32,
  maxDimension: 16000,
};
export type LocalImage = {
  canvas: HTMLCanvasElement;
  url: string;
  metadata: ImageMetadata;
  dispose: () => void;
};
export async function loadImage(file: File): Promise<LocalImage> {
  if (file.size > IMAGE_LIMITS.maxBytes)
    throw new Error("La imagen supera el límite de 40 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let mime = "";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    mime = "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    mime = "image/png";
  if (
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  )
    mime = "image/webp";
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (
    !mime ||
    file.type !== mime ||
    !(
      mime === "image/jpeg"
        ? ["jpg", "jpeg"]
        : mime === "image/png"
          ? ["png"]
          : ["webp"]
    ).includes(ext || "")
  )
    throw new Error(
      "El contenido, la extensión y el tipo deben ser JPG, PNG o WebP válidos.",
    );
  let source: ImageBitmap | HTMLImageElement;
  const objectUrl = URL.createObjectURL(file);
  try {
    if (typeof createImageBitmap === "function")
      source = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
    else {
      source = new Image();
      source.src = objectUrl;
      await source.decode();
    }
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error("No se pudo decodificar la imagen. Puede estar dañada.");
  }
  URL.revokeObjectURL(objectUrl);
  const width = source.width,
    height = source.height;
  if (
    width < 32 ||
    height < 32 ||
    width > 16000 ||
    height > 16000 ||
    width * height > IMAGE_LIMITS.maxPixels
  ) {
    if ("close" in source) source.close();
    throw new Error(
      "Usa una imagen de al menos 32 × 32 px, hasta 16 000 px por lado y 40 megapíxeles.",
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error("No hay memoria disponible para procesar esta imagen.");
  ctx.drawImage(source, 0, 0);
  if ("close" in source) source.close();
  const blob = await canvasBlob(canvas);
  const url = URL.createObjectURL(blob);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  return {
    canvas,
    url,
    metadata: {
      name: file.name.slice(0, 200),
      width,
      height,
      size: file.size,
      mime: mime as ImageMetadata["mime"],
      hash,
    },
    dispose() {
      URL.revokeObjectURL(url);
      canvas.width = canvas.height = 0;
    },
  };
}
export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(
              new Error(
                "Memoria insuficiente. Prueba con una imagen más pequeña.",
              ),
            ),
      "image/png",
    ),
  );
}
export async function processedImage(
  image: LocalImage,
  effect: PosterConfig["effect"],
  signal?: AbortSignal,
) {
  if (effect === "color")
    return new Uint8Array(await (await canvasBlob(image.canvas)).arrayBuffer());
  const canvas = document.createElement("canvas");
  canvas.width = image.canvas.width;
  canvas.height = image.canvas.height;
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Memoria insuficiente.");
    ctx.drawImage(image.canvas, 0, 0);
    for (let y = 0; y < canvas.height; y += 128) {
      signal?.throwIfAborted();
      const data = ctx.getImageData(
        0,
        y,
        canvas.width,
        Math.min(128, canvas.height - y),
      );
      for (let i = 0; i < data.data.length; i += 4) {
        const l =
          0.2126 * data.data[i] +
          0.7152 * data.data[i + 1] +
          0.0722 * data.data[i + 2];
        const v = effect === "threshold" ? (l >= 128 ? 255 : 0) : l;
        data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
      }
      ctx.putImageData(data, 0, y);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer());
  } finally {
    canvas.width = canvas.height = 0;
  }
}
