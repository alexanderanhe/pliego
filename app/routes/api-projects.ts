import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/api-projects";
import {
  assertOrigin,
  currentUser,
  publicError,
} from "../services/auth.server";
import { saveProject } from "../services/projects.server";
export async function action({ request }: Route.ActionArgs) {
  assertOrigin(request);
  try {
    const user = await currentUser(request);
    if (!user)
      return data(
        { error: "Tu sesión venció. Inicia sesión para guardar." },
        { status: 401 },
      );
    const body = await request.json();
    const id = z
      .string()
      .regex(/^[a-f0-9]{24}$/)
      .optional()
      .parse(body.id);
    return data(
      { id: await saveProject(user, body, id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof Response) throw e;
    return data({ error: publicError(e) }, { status: 400 });
  }
}
