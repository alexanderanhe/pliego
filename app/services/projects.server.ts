import mongoose from "mongoose";
import { z } from "zod";
import { configSchema, metadataSchema } from "../features/poster/schema";
import { layout, fitImage, effectiveDpi } from "../features/poster/math";
import {
  PLAN_LIMITS,
  activePlan,
  canUseFeature,
  type Account,
} from "../lib/product";
import { env } from "../lib/env.server";
import { PosterProject, User } from "../models/index.server";
import { db } from "../lib/db.server";
import type { PublicUser } from "./auth.server";
export const projectInput = z.object({
  name: z.string().trim().min(1).max(100),
  config: configSchema,
  sourceImageMetadata: metadataSchema,
});
export function pageLimit(user: Account | null) {
  return {
    guest: env.GUEST_MAX_PAGES,
    free: env.FREE_MAX_PAGES,
    premium: env.PREMIUM_MAX_PAGES,
  }[activePlan(user)];
}
export function assertPageLimit(user: Account | null, pages: number) {
  if (pages > pageLimit(user))
    throw new Error(
      `El límite de tu plan es ${pageLimit(user)} hojas. Reduce el tamaño o consulta Premium.`,
    );
}
export async function getProject(userId: string, id: string) {
  await db();
  if (!mongoose.isValidObjectId(id))
    throw new Response("Proyecto inexistente.", { status: 404 });
  const p = await PosterProject.findOne({ _id: id, userId });
  if (!p) throw new Response("Proyecto inexistente.", { status: 404 });
  return p;
}
export async function saveProject(
  user: PublicUser,
  input: unknown,
  id?: string,
) {
  if (!canUseFeature(user, "save_projects"))
    throw new Response("Inicia sesión para guardar.", { status: 403 });
  const p = projectInput.parse(input),
    l = layout(p.config);
  assertPageLimit(user, l.tiles.length);
  await db();
  const fields = {
    ...p,
    paper: { type: p.config.paper, ...l.paper },
    orientation: p.config.orientation,
    units: p.config.units,
    posterDimensions: l.poster,
    pageGrid: { columns: l.columns, rows: l.rows },
    margins: p.config.margin,
    overlap: p.config.overlap,
    fitMode: p.config.fit,
    crop: p.config.crop,
    background: p.config.background,
    guides: p.config.guides,
    qualityEstimate: effectiveDpi(
      p.sourceImageMetadata,
      fitImage(p.sourceImageMetadata, l.poster, p.config.fit, p.config.crop),
    ),
    schemaVersion: 1,
  };
  if (id) {
    await getProject(user.id, id);
    await PosterProject.updateOne(
      { _id: id, userId: user.id },
      { $set: fields },
    );
    return id;
  }
  // A transaction plus a write on the account serializes project quota checks.
  return mongoose.connection.transaction(async (session) => {
    await User.updateOne(
      { _id: user.id },
      { $inc: { projectRevision: 1 } },
      { session },
    );
    const count = await PosterProject.countDocuments({
      userId: user.id,
    }).session(session);
    if (count >= PLAN_LIMITS[activePlan(user)].savedProjects)
      throw new Error(
        "El límite de proyectos de tu plan se ha alcanzado. Elimina uno o consulta Premium.",
      );
    const [created] = await PosterProject.create(
      [{ ...fields, userId: user.id }],
      { session },
    );
    return String(created._id);
  });
}
