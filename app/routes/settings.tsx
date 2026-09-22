import { Form, Link, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/settings";
import {
  requireUser,
  assertOrigin,
  logout,
  publicError,
} from "../services/auth.server";
import { User } from "../models/index.server";
import { Button, Field, Alert } from "../components/ui";
export async function loader({ request }: Route.LoaderArgs) {
  return { user: await requireUser(request) };
}
export async function action({ request }: Route.ActionArgs) {
  assertOrigin(request);
  const user = await requireUser(request),
    form = await request.clone().formData();
  if (form.get("intent") === "revoke") return logout(request, true);
  try {
    const name = z.string().trim().max(80).parse(form.get("name"));
    await User.updateOne({ _id: user.id }, { $set: { name } });
    return { message: "Perfil actualizado." };
  } catch (e) {
    return { message: publicError(e) };
  }
}
export default function Settings({
  loaderData: { user },
  actionData,
}: Route.ComponentProps) {
  const nav = useNavigation();
  return (
    <main id="main" className="simple-page">
      <p className="eyebrow">TU CUENTA</p>
      <h1>Perfil y preferencias.</h1>
      <p>{user.email}</p>
      {actionData && <Alert>{actionData.message}</Alert>}
      <Form method="post">
        <Field label="Tu nombre (opcional)">
          <input name="name" defaultValue={user.name} maxLength={80} />
        </Field>
        <Button disabled={nav.state !== "idle"}>Guardar perfil</Button>
      </Form>
      <section className="settings-section">
        <h2>Calibración</h2>
        <p>
          {user.calibration
            ? `Factor guardado: ${user.calibration.factor.toFixed(4)}×. Las impresoras y sus ajustes pueden variar entre dispositivos.`
            : "Todavía no tienes una calibración guardada."}
        </p>
        <Link className="btn btn-secondary" to="/calibration">
          Configurar calibración
        </Link>
      </section>
      <section className="settings-section">
        <h2>Sesiones</h2>
        <p>Cierra el acceso en todos los dispositivos, incluido este.</p>
        <Form method="post">
          <Button variant="secondary" name="intent" value="revoke">
            Cerrar todas las sesiones
          </Button>
        </Form>
      </section>
    </main>
  );
}
