import { Resend } from "resend";
import { env } from "../lib/env.server";
export async function sendCode(email: string, code: string) {
  if (!env.RESEND_API_KEY && env.NODE_ENV !== "production") {
    console.warn(
      `[SOLO DESARROLLO · correo de prueba] ${email} | código: ${code} | vence en ${env.AUTH_CODE_TTL_MINUTES} minutos`,
    );
    return;
  }
  const { error } = await new Resend(env.RESEND_API_KEY).emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: email,
    subject: `Tu código de acceso a Pliego`,
    text: `Tu código de Pliego: ${code}. Vence en ${env.AUTH_CODE_TTL_MINUTES} minutos. Si no lo solicitaste, ignora este correo.`,
    html: `<div style="background:#f5f6fa;padding:32px;font-family:Arial,sans-serif;color:#18213a"><div style="max-width:480px;margin:auto;background:white;padding:32px;border-radius:16px"><h1>Pliego</h1><p>Tu próxima gran idea empieza aquí.</p><p>Este es tu código de acceso:</p><p style="font-size:40px;letter-spacing:8px;font-weight:bold">${code}</p><p>Vence en ${env.AUTH_CODE_TTL_MINUTES} minutos. No compartas este código.</p><p>Si no lo solicitaste, puedes ignorar este correo.</p></div></div>`,
  });
  if (error)
    throw new Error("No se pudo enviar el correo. Intenta de nuevo más tarde.");
}
