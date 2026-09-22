import { data } from "react-router";
import type { Route } from "./+types/api-export";
import { configSchema } from "../features/poster/schema";
import { layout } from "../features/poster/math";
import {
  assertOrigin,
  currentUser,
  publicError,
} from "../services/auth.server";
import { assertPageLimit } from "../services/projects.server";
import { DOWNLOAD_REQUIRES_ACCOUNT } from "../lib/product";
export async function action({ request }: Route.ActionArgs) {
  assertOrigin(request);
  try {
    const user = await currentUser(request);
    if (DOWNLOAD_REQUIRES_ACCOUNT && !user)
      return data({ error: "Inicia sesión para descargar." }, { status: 401 });
    const body = await request.json();
    const config = configSchema.parse(body.config);
    assertPageLimit(user, layout(config).tiles.length);
    return data({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return data({ error: publicError(e) }, { status: 400 });
  }
}
