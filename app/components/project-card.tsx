import { useState } from "react";
import { Form, Link } from "react-router";
import { Layers, Copy, Pencil, Trash2, ArrowUpRight } from "lucide-react";
import { Button, Dialog, Field } from "./ui";
export type ProjectCardData = {
  id: string;
  name: string;
  updatedAt: string;
  width: number;
  height: number;
  pages: number;
};
export function ProjectCard({ project: p }: { project: ProjectCardData }) {
  const [mode, setMode] = useState<"rename" | "delete" | null>(null);
  return (
    <article className="project-card">
      <div className="project-placeholder">
        <Layers size={35} />
        <span>{p.pages} hojas</span>
      </div>
      <h3>{p.name}</h3>
      <p>
        {(p.width / 10).toFixed(1)} × {(p.height / 10).toFixed(1)} cm
      </p>
      <small>
        Actualizado{" "}
        {new Date(p.updatedAt).toLocaleDateString("es-MX", { timeZone: "UTC" })}
      </small>
      <Link className="project-open" to={`/projects/${p.id}`}>
        Abrir proyecto <ArrowUpRight size={17} />
      </Link>
      <div className="project-actions">
        <Form method="post">
          <input type="hidden" name="id" value={p.id} />
          <button
            name="intent"
            value="duplicate"
            aria-label={`Duplicar ${p.name}`}
          >
            <Copy size={16} />
            Duplicar
          </button>
        </Form>
        <button
          onClick={() => setMode("rename")}
          aria-label={`Renombrar ${p.name}`}
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => setMode("delete")}
          aria-label={`Eliminar ${p.name}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
      <Dialog
        open={mode !== null}
        title={
          mode === "delete" ? "¿Eliminar este proyecto?" : "Renombrar proyecto"
        }
        onClose={() => setMode(null)}
      >
        <Form method="post" onSubmit={() => setMode(null)}>
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="intent" value={mode || ""} />
          {mode === "rename" ? (
            <Field label="Nombre">
              <input
                name="name"
                defaultValue={p.name}
                maxLength={100}
                required
              />
            </Field>
          ) : (
            <p>Se eliminará «{p.name}». Esta acción no se puede deshacer.</p>
          )}
          <div className="flex justify-end gap-3 mt-5">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setMode(null)}
            >
              Cancelar
            </Button>
            <Button type="submit">
              {mode === "delete" ? "Eliminar proyecto" : "Guardar nombre"}
            </Button>
          </div>
        </Form>
      </Dialog>
    </article>
  );
}
