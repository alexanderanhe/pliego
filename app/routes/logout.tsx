import type { Route } from "./+types/logout";
import { logout } from "../services/auth.server";
export async function action({ request }: Route.ActionArgs) {
  return logout(request);
}
