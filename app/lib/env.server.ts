import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.string().url().default("http://localhost:5173"),
  SESSION_SECRET: z
    .string()
    .default("development-only-change-before-deploy-000000"),
  MONGODB_URI: z.string().default(""),
  MONGODB_DB_NAME: z.string().default("pliego"),
  RESEND_API_KEY: z.string().default(""),
  RESEND_FROM_EMAIL: z.string().default(""),
  AUTH_CODE_TTL_MINUTES: z.coerce.number().int().min(1).max(10).default(10),
  AUTH_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().min(60).default(60),
  GUEST_MAX_PAGES: z.coerce.number().int().min(1).max(200).default(12),
  FREE_MAX_PAGES: z.coerce.number().int().min(1).max(200).default(30),
  PREMIUM_MAX_PAGES: z.coerce.number().int().min(1).max(200).default(200),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
});
export const env = schema.parse(
  Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== "")),
);
if (env.NODE_ENV === "production") {
  for (const key of [
    "APP_URL",
    "SESSION_SECRET",
    "MONGODB_URI",
    "MONGODB_DB_NAME",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
  ] as const)
    if (!process.env[key]) throw new Error(`Configuración requerida: ${key}`);
  if (
    env.SESSION_SECRET.length < 32 ||
    env.SESSION_SECRET.startsWith("development-")
  )
    throw new Error(
      "SESSION_SECRET debe ser aleatorio y tener al menos 32 caracteres.",
    );
  if (!env.APP_URL.startsWith("https://"))
    throw new Error("APP_URL debe usar HTTPS en producción.");
}
