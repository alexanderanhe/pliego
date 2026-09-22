import { Link } from "react-router";
import { Plus, FolderOpen, ArrowUpRight } from "lucide-react";
import { z } from "zod";
import type { Route } from "./+types/dashboard";
import {
  requireUser,
  assertOrigin,
  publicError,
} from "../services/auth.server";
import { PosterProject } from "../models/index.server";
import { getProject, saveProject } from "../services/projects.server";
import { activePlan, PLAN_LIMITS } from "../lib/product";
import { ProjectCard } from "../components/project-card";
import { Alert } from "../components/ui";
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request),
    projects = await PosterProject.find({ userId: user.id })
      .sort({ updatedAt: -1 })
      .limit(100);
  return {
    user,
    projects: projects.map((p) => ({
      id: String(p._id),
      name: String(p.name),
      updatedAt: p.updatedAt.toISOString(),
      width: Number(p.posterDimensions.width),
      height: Number(p.posterDimensions.height),
      pages: Number(p.pageGrid.columns * p.pageGrid.rows),
    })),
  };
}
export async function action({ request }: Route.ActionArgs) {
  assertOrigin(request);
  const user = await requireUser(request),
    form = await request.formData();
  try {
    const id = z
        .string()
        .regex(/^[a-f0-9]{24}$/)
        .parse(form.get("id")),
      p = await getProject(user.id, id);
    switch (form.get("intent")) {
      case "delete":
        await PosterProject.deleteOne({ _id: id, userId: user.id });
        break;
      case "rename":
        await PosterProject.updateOne(
          { _id: id, userId: user.id },
          {
            $set: {
              name: z.string().trim().min(1).max(100).parse(form.get("name")),
            },
          },
        );
        break;
      case "duplicate":
        await saveProject(user, {
          name: `${p.name} (copia)`.slice(0, 100),
          config: p.config,
          sourceImageMetadata: p.sourceImageMetadata,
        });
        break;
      default:
        throw new Error("Invalid action");
    }
    return { error: null };
  } catch (e) {
    if (e instanceof Response) throw e;
    return { error: publicError(e) };
  }
}
export default function Dashboard({
  loaderData: { user, projects },
  actionData,
}: Route.ComponentProps) {
  const plan = activePlan(user);
  return (
    <main id="main" className="page-width dashboard">
      <div className="section-heading">
        <div>
          <p className="eyebrow">TU ESPACIO CREATIVO</p>
          <h1>Hola{user.name ? `, ${user.name}` : ""}.</h1>
          <p>{user.email}</p>
        </div>
        <Link to="/editor" className="btn btn-primary">
          <Plus size={18} />
          Crear un póster
        </Link>
      </div>
      <div className="account-strip">
        <span>
          Plan <strong>{plan === "premium" ? "Premium" : "Gratuito"}</strong> ·{" "}
          {projects.length} / {PLAN_LIMITS[plan].savedProjects} proyectos
        </span>
        <Link to="/settings">
          Perfil y calibración <ArrowUpRight size={16} />
        </Link>
      </div>
      {actionData?.error && <Alert>{actionData.error}</Alert>}
      <h2 className="mb-6">Tus proyectos</h2>
      <p className="control-hint mb-5">
        Guardamos tus ajustes. Para volver a editar, selecciona la imagen
        original desde tu dispositivo.
      </p>
      {projects.length ? (
        <div className="projects-grid">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FolderOpen size={42} />
          <h2>Tu próxima gran idea empieza aquí.</h2>
          <p>Los proyectos que guardes aparecerán en este espacio.</p>
          <Link to="/editor" className="btn btn-primary">
            Crear mi primer póster
          </Link>
        </div>
      )}
    </main>
  );
}
