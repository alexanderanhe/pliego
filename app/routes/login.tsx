import { Form, Link, redirect, useNavigation } from "react-router";
import { Mail, ArrowRight, ShieldCheck } from "lucide-react";
import type { Route } from "./+types/login";
import { requestCode, publicError, safeReturn } from "../services/auth.server";
import { env } from "../lib/env.server";
import { Field, Button, Alert } from "../components/ui";
export function loader({ request }: Route.LoaderArgs) {
  return {
    returnTo: safeReturn(new URL(request.url).searchParams.get("returnTo")),
    configured: !!env.MONGODB_URI,
  };
}
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  try {
    const email = await requestCode(request, form.get("email"));
    return redirect(
      `/verify?email=${encodeURIComponent(email)}&returnTo=${encodeURIComponent(safeReturn(form.get("returnTo")))}`,
    );
  } catch (e) {
    if (e instanceof Response) throw e;
    return { error: publicError(e) };
  }
}
export default function Login({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  return (
    <main id="main" className="auth-page">
      <div className="auth-card">
        <span className="auth-icon">
          <Mail size={25} />
        </span>
        <p className="eyebrow">UN ESPACIO PARA TUS IDEAS</p>
        <h1>Qué bueno verte por aquí.</h1>
        <p>
          Guarda tus proyectos y vuelve a ellos cuando quieras. Sin contraseñas
          que recordar.
        </p>
        {!loaderData.configured && (
          <Alert>
            El editor funciona sin cuenta. Para activar el acceso por correo,
            configura MongoDB en el servidor.
          </Alert>
        )}
        {actionData?.error && <Alert>{actionData.error}</Alert>}
        <Form method="post">
          <input type="hidden" name="returnTo" value={loaderData.returnTo} />
          <Field label="Tu correo electrónico">
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="hola@ejemplo.com"
              maxLength={254}
              required
            />
          </Field>
          <Button type="submit" disabled={navigation.state !== "idle"}>
            {navigation.state !== "idle"
              ? "Enviando…"
              : "Enviar código de acceso"}
            <ArrowRight size={18} />
          </Button>
        </Form>
        <small>
          <ShieldCheck size={14} /> Te enviaremos un código de seis dígitos.
        </small>
        <p className="fine-print">
          Al continuar, aceptas nuestros <Link to="/terms">términos</Link> y la{" "}
          <Link to="/privacy">política de privacidad</Link>.
        </p>
      </div>
    </main>
  );
}
