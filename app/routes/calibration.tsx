import { useEffect, useState } from "react";
import { useFetcher, Link } from "react-router";
import { Download, Ruler } from "lucide-react";
import { z } from "zod";
import type { Route } from "./+types/calibration";
import { calibrationPdf } from "../features/poster/pdf";
import { calibrationFactor } from "../features/poster/math";
import {
  assertOrigin,
  currentUser,
  requireUser,
  publicError,
} from "../services/auth.server";
import { User } from "../models/index.server";
import { Field, Button, Alert } from "../components/ui";
export async function loader({ request }: Route.LoaderArgs) {
  return { user: await currentUser(request) };
}
export async function action({ request }: Route.ActionArgs) {
  assertOrigin(request);
  const user = await requireUser(request);
  try {
    const form = await request.formData(),
      n = z.coerce.number().min(83.34).max(125),
      width = n.parse(form.get("width")),
      height = n.parse(form.get("height"));
    await User.updateOne(
      { _id: user.id },
      {
        $set: {
          calibration: {
            width,
            height,
            factor: calibrationFactor(width, height),
          },
        },
      },
    );
    return { message: "Calibración guardada en tu perfil." };
  } catch (e) {
    return { message: publicError(e) };
  }
}
export default function Calibration({
  loaderData: { user },
}: Route.ComponentProps) {
  const [width, setWidth] = useState(100),
    [height, setHeight] = useState(100),
    [message, setMessage] = useState(""),
    [url, setUrl] = useState("");
  const fetcher = useFetcher<typeof action>();
  useEffect(() => {
    try {
      const c =
        user?.calibration ||
        JSON.parse(localStorage.getItem("pliego-calibration") || "null");
      if (c) {
        setWidth(c.width);
        setHeight(c.height);
      }
    } catch {
      /* Storage is optional. */
    }
  }, [user]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  const valid =
    width >= 83.34 && width <= 125 && height >= 83.34 && height <= 125;
  const factor = valid ? calibrationFactor(width, height) : 1;
  async function generate() {
    try {
      const bytes = await calibrationPdf();
      setUrl(
        URL.createObjectURL(
          new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
        ),
      );
    } catch {
      setMessage("No se pudo crear la hoja. Intenta nuevamente.");
    }
  }
  return (
    <main id="main" className="simple-page calibration">
      <span className="auth-icon">
        <Ruler />
      </span>
      <p className="eyebrow">CADA MILÍMETRO CUENTA</p>
      <h1>Conoce tu impresora.</h1>
      <p>
        Algunas impresoras cambian la escala. Esta prueba te ayuda a comprobarlo
        antes de crear un póster grande.
      </p>
      <ol className="calibration-steps">
        <li>
          <h2>1. Imprime una referencia exacta</h2>
          <p>
            La hoja contiene un cuadrado de 100 × 100 mm y dos reglas. Imprime
            al <strong>100 %</strong>, sin “Ajustar a página”.
          </p>
          {url ? (
            <a
              href={url}
              download="pliego-calibracion-100mm.pdf"
              className="btn btn-primary"
            >
              <Download size={17} />
              Descargar hoja de calibración
            </a>
          ) : (
            <Button onClick={generate}>
              <Download size={17} />
              Generar hoja de calibración
            </Button>
          )}
        </li>
        <li>
          <h2>2. Mide el cuadrado impreso</h2>
          <p>Mide de centro a centro de las líneas, en milímetros.</p>
          <div className="two-fields">
            <Field label="Ancho real (mm)">
              <input
                type="number"
                min={83.34}
                max={125}
                step="0.1"
                value={width}
                onChange={(e) => setWidth(+e.target.value)}
              />
            </Field>
            <Field label="Alto real (mm)">
              <input
                type="number"
                min={83.34}
                max={125}
                step="0.1"
                value={height}
                onChange={(e) => setHeight(+e.target.value)}
              />
            </Field>
          </div>
          {!valid && (
            <Alert>
              Introduce valores entre 83.34 y 125 mm. Para diferencias mayores,
              revisa primero los ajustes de impresión.
            </Alert>
          )}
        </li>
        <li>
          <h2>3. Guarda tu corrección</h2>
          <p>
            Factor uniforme: <strong>{factor.toFixed(4)}×</strong>. Promediamos
            ambos ejes para conservar la proporción.
          </p>
          {Math.abs(width - height) > 1 && (
            <Alert>
              Los ejes difieren en más de 1 mm. Una corrección uniforme no puede
              corregir ambos exactamente. Revisa el controlador y vuelve a
              medir.
            </Alert>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!valid}
              onClick={() => {
                try {
                  localStorage.setItem(
                    "pliego-calibration",
                    JSON.stringify({ width, height, factor }),
                  );
                  setMessage(
                    "Guardada en este navegador. Actívala en las opciones del editor para aplicarla.",
                  );
                } catch {
                  setMessage("El navegador no permite guardar preferencias.");
                }
              }}
            >
              Guardar en este dispositivo
            </Button>
            {user ? (
              <Button
                variant="secondary"
                disabled={!valid || fetcher.state !== "idle"}
                onClick={() =>
                  fetcher.submit({ width, height }, { method: "post" })
                }
              >
                Guardar en mi perfil
              </Button>
            ) : (
              <Link
                to="/login?returnTo=%2Fcalibration"
                className="btn btn-secondary"
              >
                Inicia sesión para sincronizar
              </Link>
            )}
          </div>
        </li>
      </ol>
      {(message || fetcher.data?.message) && (
        <Alert>{message || fetcher.data?.message}</Alert>
      )}
      <p className="control-hint">
        No se aplica automáticamente. Activa “Aplicar calibración” en el editor.
        Los márgenes físicos del papel se conservan; la capacidad de cada hoja
        se ajusta al factor.
      </p>
      <Link to="/editor" className="btn btn-secondary">
        Volver al editor
      </Link>
    </main>
  );
}
