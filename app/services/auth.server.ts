import { createCookie, redirect } from "react-router";
import { z } from "zod";
import { env } from "../lib/env.server";
import { db } from "../lib/db.server";
import {
  User,
  Session,
  VerificationCode,
  RateLimit,
} from "../models/index.server";
import {
  createCode,
  createToken,
  hashSecret,
  secureEqual,
} from "../features/auth/crypto.server";
import { sendCode } from "./mail.server";
import type { Account } from "../lib/product";
export type PublicUser = Account & {
  id: string;
  email: string;
  name?: string;
  calibration?: { factor: number; width: number; height: number };
};
export const hash = (value: string) => hashSecret(value, env.SESSION_SECRET);
const cookie = createCookie("pliego_session", {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
  secrets: [env.SESSION_SECRET],
});
export function assertOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(env.APP_URL).origin)
    throw new Response("Solicitud no permitida.", { status: 403 });
}
export function safeReturn(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : "/dashboard";
}
export function ipHash(request: Request) {
  return hash(
    env.TRUST_PROXY === "true"
      ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown"
      : "shared-untrusted-network",
  );
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  await db();
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const id = hash(`${key}:${bucket}`);
  const r = await RateLimit.findOneAndUpdate(
    { _id: id },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date((bucket + 2) * seconds * 1000) },
    },
    { upsert: true, new: true },
  );
  if (r.count > limit)
    throw new Error(
      "Demasiadas solicitudes. Espera unos minutos antes de intentarlo otra vez.",
    );
}
export async function requestCode(request: Request, emailInput: unknown) {
  assertOrigin(request);
  const email = z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(254)
    .parse(emailInput);
  await rateLimit(`request-ip:${ipHash(request)}`, 30, 3600);
  await rateLimit(`request-email:${email}`, 6, 3600);
  const now = new Date();
  try {
    await RateLimit.findOneAndUpdate(
      { _id: hash(`cooldown:${email}`), expiresAt: { $lte: now } },
      {
        $set: {
          expiresAt: new Date(+now + env.AUTH_RESEND_COOLDOWN_SECONDS * 1000),
          count: 1,
        },
      },
      { upsert: true },
    );
  } catch (e) {
    if ((e as { code?: number }).code === 11000)
      throw new Error(
        `Espera ${env.AUTH_RESEND_COOLDOWN_SECONDS} segundos antes de reenviar el código.`,
        { cause: e },
      );
    throw e;
  }
  const code = createCode();
  await VerificationCode.updateMany(
    { normalizedEmail: email, consumedAt: null },
    { $set: { consumedAt: now } },
  );
  const record = await VerificationCode.create({
    normalizedEmail: email,
    codeHash: hash(`${email}:sign_in:${code}`),
    purpose: "sign_in",
    expiresAt: new Date(+now + env.AUTH_CODE_TTL_MINUTES * 60000),
  });
  try {
    await sendCode(email, code);
  } catch (e) {
    await VerificationCode.updateOne(
      { _id: record._id },
      { $set: { consumedAt: new Date() } },
    );
    throw e;
  }
  console.info(
    JSON.stringify({
      event: "auth.code_requested",
      subject: hash(email),
      at: now.toISOString(),
    }),
  );
  return email;
}
export async function verifyCode(
  request: Request,
  input: { email: unknown; code: unknown; returnTo: unknown },
) {
  assertOrigin(request);
  const { email, code } = z
    .object({
      email: z.string().trim().toLowerCase().email().max(254),
      code: z.string().regex(/^\d{6}$/),
    })
    .parse(input);
  await rateLimit(`verify-ip:${ipHash(request)}`, 50, 900);
  await rateLimit(`verify-email:${email}`, 20, 900);
  const record = await VerificationCode.findOneAndUpdate(
    {
      normalizedEmail: email,
      purpose: "sign_in",
      consumedAt: null,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: 5 },
    },
    { $inc: { attempts: 1 } },
    { new: true, sort: { createdAt: -1 } },
  );
  if (
    !record ||
    !secureEqual(record.codeHash, hash(`${email}:sign_in:${code}`))
  ) {
    console.info(
      JSON.stringify({
        event: "auth.verification_failed",
        subject: hash(email),
      }),
    );
    throw new Error(
      "Código incorrecto, vencido o sin intentos disponibles. Solicita uno nuevo cuando hayan pasado 60 segundos.",
    );
  }
  const consumed = await VerificationCode.updateOne(
    { _id: record._id, consumedAt: null },
    { $set: { consumedAt: new Date() } },
  );
  if (consumed.modifiedCount !== 1)
    throw new Error("Este código ya fue utilizado.");
  const user = await User.findOneAndUpdate(
    { normalizedEmail: email },
    {
      $set: { emailVerifiedAt: new Date() },
      $setOnInsert: { email, normalizedEmail: email },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const old = await cookie.parse(request.headers.get("Cookie"));
  if (typeof old === "string")
    await Session.deleteOne({ tokenHash: hash(old) });
  const token = createToken();
  await Session.create({
    userId: user._id,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + 30 * 86400000),
    lastUsedAt: new Date(),
    userAgent: request.headers.get("user-agent")?.slice(0, 300),
    ipHash: ipHash(request),
  });
  console.info(
    JSON.stringify({ event: "auth.signed_in", subject: hash(email) }),
  );
  return redirect(safeReturn(input.returnTo), {
    headers: { "Set-Cookie": await cookie.serialize(token) },
  });
}
export async function currentUser(
  request: Request,
): Promise<PublicUser | null> {
  const token = await cookie.parse(request.headers.get("Cookie"));
  if (typeof token !== "string" || !token) return null;
  await db();
  const session = await Session.findOneAndUpdate(
    { tokenHash: hash(token), expiresAt: { $gt: new Date() } },
    { $set: { lastUsedAt: new Date() } },
    { new: true },
  );
  if (!session) return null;
  const u = await User.findById(session.userId);
  return u
    ? {
        id: String(u._id),
        email: u.email,
        name: u.name,
        plan: u.plan,
        planStatus: u.planStatus,
        planExpiresAt: u.planExpiresAt?.toISOString(),
        entitlements: u.entitlements,
        calibration: u.calibration?.factor
          ? {
              factor: u.calibration.factor,
              width: u.calibration.width,
              height: u.calibration.height,
            }
          : undefined,
      }
    : null;
}
export async function requireUser(request: Request) {
  const user = await currentUser(request);
  if (!user)
    throw redirect(
      `/login?returnTo=${encodeURIComponent(new URL(request.url).pathname)}`,
    );
  return user;
}
export async function logout(request: Request, all = false) {
  assertOrigin(request);
  const user = await requireUser(request);
  if (all) await Session.deleteMany({ userId: user.id });
  else {
    const token = await cookie.parse(request.headers.get("Cookie"));
    await Session.deleteOne({ tokenHash: hash(token), userId: user.id });
  }
  return redirect("/", {
    headers: { "Set-Cookie": await cookie.serialize("", { maxAge: 0 }) },
  });
}
export function publicError(error: unknown) {
  if (error instanceof z.ZodError) return "Revisa los datos introducidos.";
  if (
    error instanceof Error &&
    /^(Configura|No se pudo|Espera|Demasiadas|Código|Este código|El límite|El proyecto)/.test(
      error.message,
    )
  )
    return error.message;
  return "No se pudo completar la operación. Comprueba la conexión e inténtalo nuevamente.";
}
