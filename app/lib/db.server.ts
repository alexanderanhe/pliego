import mongoose from "mongoose";
import { env } from "./env.server";
let connection: Promise<typeof mongoose> | undefined;
export async function db() {
  if (!env.MONGODB_URI)
    throw new Error(
      "Configura MONGODB_URI para usar cuentas y proyectos. El editor público sigue disponible.",
    );
  connection ??= mongoose
    .connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 5000,
    })
    .catch((e) => {
      connection = undefined;
      throw e;
    });
  await connection;
}
