import type { Route } from "./+types/project";
import { requireUser } from "../services/auth.server";
import { getProject } from "../services/projects.server";
import { configSchema, metadataSchema } from "../features/poster/schema";
import PosterEditor from "../features/poster/editor";
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request),
    p = await getProject(user.id, params.projectId);
  return {
    project: {
      id: String(p._id),
      name: String(p.name),
      config: configSchema.parse(p.config),
      sourceImageMetadata: metadataSchema.parse(p.sourceImageMetadata),
    },
  };
}
export default function Project({ loaderData }: Route.ComponentProps) {
  return (
    <PosterEditor key={loaderData.project.id} project={loaderData.project} />
  );
}
