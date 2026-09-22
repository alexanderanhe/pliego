import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { PDFDocument } from "pdf-lib";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("crea un PDF Carta de cuatro páginas", async ({ page }) => {
  const png = new PNG({ width: 128, height: 128 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 35;
    png.data[i + 1] = 86;
    png.data[i + 2] = 214;
    png.data[i + 3] = 255;
  }
  const file = join(tmpdir(), `pliego-e2e-${Date.now()}.png`);
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(file);
    stream.on("finish", resolve);
    stream.on("error", reject);
    png.pack().pipe(stream);
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Crear mi póster" }).click();
  await page.locator("input[type=file]").first().setInputFiles(file);
  await expect(page.getByText("Configura tu póster")).toBeVisible();
  await expect(page.getByLabel("Hojas de ancho")).toHaveValue("2");
  await expect(page.getByLabel("Hojas de alto")).toHaveValue("2");
  await page.getByRole("button", { name: /Revisar póster/ }).click();
  await expect(page.getByRole("button", { name: /Generar PDF/ })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Generar PDF/ }).click();
  const download = await downloadPromise;
  const bytes = await download.createReadStream();
  const chunks = [];
  for await (const chunk of bytes ?? []) chunks.push(chunk);
  const pdf = await PDFDocument.load(Buffer.concat(chunks));
  expect(pdf.getPageCount()).toBe(4);
  for (const p of pdf.getPages())
    expect(p.getSize()).toMatchObject({ width: 612, height: 792 });
});
