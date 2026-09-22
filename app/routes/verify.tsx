import { useEffect, useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/verify";
import {
  requestCode,
  verifyCode,
  publicError,
  safeReturn,
} from "../services/auth.server";
import { env } from "../lib/env.server";
import { Field, Button, Alert } from "../components/ui";
export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  return {
    email: url.searchParams.get("email") || "",
    returnTo: safeReturn(url.searchParams.get("returnTo")),
    cooldown: env.AUTH_RESEND_COOLDOWN_SECONDS,
  };
}
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  try {
    if (form.get("intent") === "resend") {
      await requestCode(request, form.get("email"));
      return {
        message: "Si la solicitud es válida, recibirás un nuevo código.",
        error: null,
      };
    }
    return await verifyCode(request, {
      email: form.get("email"),
      code: form.get("code"),
      returnTo: form.get("returnTo"),
    });
  } catch (e) {
    if (e instanceof Response) throw e;
    return { error: publicError(e), message: null };
  }
}
export default function Verify({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const [remaining, setRemaining] = useState(loaderData.cooldown),
    nav = useNavigation();
  useEffect(() => {
    const timer = setInterval(
      () => setRemaining((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (actionData?.message) setRemaining(loaderData.cooldown);
  }, [actionData, loaderData.cooldown]);
  return (
    <main id="main" className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">REVISA TU BANDEJA DE ENTRADA</p>
        <h1>
          Seis dígitos.
          <br />Y ya estás dentro.
        </h1>
        <p>
          Introduce el código enviado a <strong>{loaderData.email}</strong>.
          Vence en 10 minutos.
        </p>
        {actionData?.error && <Alert>{actionData.error}</Alert>}
        {actionData?.message && <Alert>{actionData.message}</Alert>}
        <Form method="post">
          <input type="hidden" name="email" value={loaderData.email} />
          <input type="hidden" name="returnTo" value={loaderData.returnTo} />
          <Field label="Código de acceso">
            <input
              name="code"
              className="code-input"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="000000"
              required
            />
          </Field>
          <Button type="submit" disabled={nav.state !== "idle"}>
            Verificar e iniciar sesión
          </Button>
        </Form>
        <Form method="post">
          <input type="hidden" name="email" value={loaderData.email} />
          <input type="hidden" name="intent" value="resend" />
          <Button
            type="submit"
            variant="quiet"
            disabled={remaining > 0 || nav.state !== "idle"}
          >
            {remaining > 0 ? `Reenviar en ${remaining} s` : "Reenviar código"}
          </Button>
        </Form>
        <Link to={`/login?returnTo=${encodeURIComponent(loaderData.returnTo)}`}>
          Usar otro correo
        </Link>
      </div>
    </main>
  );
}
