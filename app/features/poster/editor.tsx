import { useEffect, useRef, useState } from "react";
import { Link, useRouteLoaderData } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
  ShieldCheck,
  Image as ImageIcon,
  Check,
} from "lucide-react";
import {
  Button,
  Field,
  Alert,
  Progress,
  PremiumBadge,
  Tooltip,
  IconToggle,
  ScrubNumber,
} from "../../components/ui";
import {
  FiDownload,
  FiMove,
  FiRefreshCw,
  FiSave,
  FiZoomIn,
  FiZoomOut,
} from "react-icons/fi";
import { UploadArea } from "../../components/upload";
import {
  configSchema,
  DEFAULT_CONFIG,
  type PosterConfig,
  type ImageMetadata,
} from "./schema";
import {
  layout,
  fromMm,
  toMm,
  fitImage,
  effectiveDpi,
  qualityLabel,
  PAPERS,
} from "./math";
import { loadImage, processedImage, type LocalImage } from "./image";
import { draft } from "./draft";
import { Preview } from "./preview";
import { generatePdf, safeFilename } from "./pdf";
import type { loader as rootLoader } from "../../root";
export type SavedProject = {
  id: string;
  name: string;
  config: PosterConfig;
  sourceImageMetadata: ImageMetadata;
};
const steps = ["Tu imagen", "Tamaño y encuadre", "Vista previa", "Descargar"];
export default function PosterEditor({ project }: { project?: SavedProject }) {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const [config, setConfig] = useState<PosterConfig>(
      project?.config || DEFAULT_CONFIG,
    ),
    [image, setImage] = useState<LocalImage>(),
    [step, setStep] = useState(0),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [pdf, setPdf] = useState(""),
    [page, setPage] = useState<number | null>(null),
    [zoom, setZoom] = useState(100),
    [lockAspect, setLockAspect] = useState(true),
    [name, setName] = useState(project?.name || ""),
    [projectId, setProjectId] = useState(project?.id),
    [saving, setSaving] = useState(false);
  const abort = useRef<AbortController | null>(null),
    pdfRef = useRef(""),
    initialized = useRef(false),
    fileInput = useRef<HTMLInputElement>(null);
  const update = (patch: Partial<PosterConfig>) => {
    setConfig((c) => ({ ...c, ...patch }));
    setError("");
    if (pdfRef.current) {
      URL.revokeObjectURL(pdfRef.current);
      pdfRef.current = "";
      setPdf("");
    }
  };
  async function choose(file: File) {
    setBusy(true);
    setError("");
    try {
      const next = await loadImage(file);
      if (project && next.metadata.hash !== project.sourceImageMetadata.hash) {
        next.dispose();
        throw new Error(
          "La imagen no coincide con la huella del proyecto. Selecciona el archivo original.",
        );
      }
      draft.image?.dispose();
      draft.image = next;
      setImage(next);
      if (!project) {
        setName(file.name.replace(/\.[^.]+$/, ""));
        update({
          orientation:
            next.metadata.width > next.metadata.height
              ? "landscape"
              : "portrait",
        });
      }
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir la imagen.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (!project) {
      try {
        const saved = JSON.parse(
          sessionStorage.getItem("pliego-draft") || "null",
        );
        if (saved) {
          setConfig(configSchema.parse(saved.config));
          setName(saved.name || "");
        }
      } catch {
        /* Invalid or unavailable browser storage does not block editing. */
      }
    }
    if (
      draft.image &&
      (!project ||
        draft.image.metadata.hash === project.sourceImageMetadata.hash)
    ) {
      setImage(draft.image);
      setStep(1);
    }
    if (draft.file) {
      const file = draft.file;
      draft.file = undefined;
      void choose(file);
    }
    try {
      const saved = localStorage.getItem("pliego-calibration");
      if (saved && !project)
        setConfig((c) => ({
          ...c,
          calibration: Number(JSON.parse(saved).factor) || 1,
        }));
    } catch {
      /* Private browsing may disable storage. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        sessionStorage.setItem(
          "pliego-draft",
          JSON.stringify({ config, name }),
        );
      } catch {
        /* Editing still works without storage. */
      }
  }, [ready, config, name]);
  useEffect(
    () => () => {
      abort.current?.abort();
      if (pdfRef.current) URL.revokeObjectURL(pdfRef.current);
    },
    [],
  );
  let l: ReturnType<typeof layout> | undefined;
  let geometryError = "";
  try {
    l = layout(config);
  } catch (e) {
    geometryError = (e as Error).message;
  }
  const dpi =
    image && l
      ? effectiveDpi(
          image.metadata,
          fitImage(image.metadata, l.poster, config.fit, config.crop),
        )
      : 0;
  const limit = root?.maxPages || 12;
  const overLimit = !!l && l.tiles.length > limit;
  function exact(axis: "width" | "height", value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    const mm = toMm(value, config.units),
      ratio = l
        ? l.poster.width / l.poster.height
        : config.sizing === "exact" && config.height > 0
          ? config.width / config.height
          : DEFAULT_CONFIG.width / DEFAULT_CONFIG.height;
    const currentWidth = l?.poster.width ?? config.width;
    const currentHeight = l?.poster.height ?? config.height;
    update({
      sizing: "exact",
      width: axis === "width" ? mm : lockAspect ? mm * ratio : currentWidth,
      height: axis === "height" ? mm : lockAspect ? mm / ratio : currentHeight,
    });
  }
  async function exportPdf() {
    if (!image || !l) return;
    setError("");
    setBusy(true);
    setProgress(0);
    abort.current = new AbortController();
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
        signal: abort.current.signal,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "No se pudo autorizar la descarga.");
      const bytes = await processedImage(
        image,
        config.effect,
        abort.current.signal,
      );
      const resultPdf = await generatePdf(bytes, image.metadata, config, {
        signal: abort.current.signal,
        onProgress: setProgress,
      });
      if (pdfRef.current) URL.revokeObjectURL(pdfRef.current);
      pdfRef.current = URL.createObjectURL(
        new Blob([new Uint8Array(resultPdf)], { type: "application/pdf" }),
      );
      setPdf(pdfRef.current);
      setStep(3);
    } catch (e) {
      setError(
        (e as Error).name === "AbortError"
          ? "Generación cancelada. Puedes volver a intentarlo."
          : e instanceof Error
            ? e.message
            : "No se pudo generar el PDF. Prueba con una imagen más pequeña.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!image) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: projectId,
          name: name || "Mi póster",
          config,
          sourceImageMetadata: image.metadata,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setProjectId(result.id);
      setMessage(
        "Proyecto guardado. Para reabrirlo necesitarás la imagen original.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const number = (
    label: string,
    value: number,
    onChange: (n: number) => void,
    min = 0,
    max = 200,
    step = 1,
  ) => (
    <ScrubNumber
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={onChange}
    />
  );
  return (
    <main id="main" className="editor-page page-width">
      <div className="editor-heading">
        <div>
          <p className="eyebrow">TU PRÓXIMO GRAN PROYECTO</p>
          <h1>De imagen a póster.</h1>
        </div>
        <div className="local-badge">
          <ShieldCheck size={16} /> Edición privada en tu dispositivo
        </div>
      </div>
      <ol className="steps">
        {steps.map((s, i) => (
          <li
            key={s}
            className={i === step ? "current" : i < step ? "complete" : ""}
          >
            <button
              disabled={(i > 0 && !image) || (i === 3 && !pdf) || busy}
              onClick={() => setStep(i)}
            >
              <span>{i < step ? <Check size={15} /> : i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      {(error || geometryError) && <Alert>{error || geometryError}</Alert>}
      {message && <Alert>{message}</Alert>}
      {step === 0 ? (
        <div className="editor-upload">
          {project && (
            <Alert>
              Este proyecto guarda la configuración, no la imagen. Vuelve a
              seleccionar «{project.sourceImageMetadata.name}». Verificaremos su
              huella.
            </Alert>
          )}
          <UploadArea busy={busy} onFile={choose} />
          <div className="privacy-note">
            <ShieldCheck size={16} />
            Tu archivo nunca sale de este navegador.
          </div>
        </div>
      ) : step === 3 && pdf && l ? (
        <section className="download-panel">
          <span className="success-icon">
            <Check size={32} />
          </span>
          <p className="eyebrow">LISTO PARA COBRAR VIDA</p>
          <h2>Tu póster ya tiene forma.</h2>
          <p>
            {l.tiles.length} hojas · {fromMm(l.poster.width, "cm").toFixed(1)} ×{" "}
            {fromMm(l.poster.height, "cm").toFixed(1)} cm ·{" "}
            {config.paper === "custom"
              ? "Papel personalizado"
              : PAPERS[config.paper].label}
          </p>
          <a
            className="btn btn-primary"
            href={pdf}
            download={`poster-${safeFilename(name || "imagen")}-${l.columns}x${l.rows}-${config.paper}.pdf`}
          >
            <FiDownload aria-hidden="true" />
            Descargar PDF
          </a>
          <Alert>
            <strong>Imprime en “Tamaño real” o “100 %”.</strong>
            <br />
            Desactiva “Ajustar a página” y la impresión a doble cara.
          </Alert>
          <p>
            Recorta los márgenes de todas las hojas. En las hojas con unión,
            recorta además la franja superior e izquierda hasta la guía y
            conserva las franjas opuestas para pegar debajo. Usa las etiquetas
            para mantener el orden.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="secondary" onClick={() => setStep(1)}>
              <ArrowLeft size={16} />
              Volver al editor
            </Button>
            <Link className="btn btn-secondary" to="/calibration">
              Comprobar mi impresora
            </Link>
          </div>
        </section>
      ) : (
        <div className="editor-layout">
          <aside className="editor-controls">
            <div className="control-heading">
              <SlidersHorizontal size={18} />
              <h2>
                {step === 1
                  ? "Configura tu póster"
                  : "Todo listo para imprimir"}
              </h2>
            </div>
            {image && (
              <div className="image-summary">
                <img
                  src={image.url}
                  alt="Miniatura de la imagen seleccionada"
                />
                <div>
                  <strong>{image.metadata.name}</strong>
                  <small>
                    {image.metadata.width} × {image.metadata.height} px ·{" "}
                    {(image.metadata.size / 1024 / 1024).toFixed(1)} MB
                  </small>
                  <small>
                    Proporción{" "}
                    {(image.metadata.width / image.metadata.height).toFixed(2)}
                    :1
                  </small>
                  <button
                    onClick={() => fileInput.current?.click()}
                    disabled={busy}
                  >
                    Cambiar imagen
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    aria-label="Cambiar imagen"
                    onChange={(e) => {
                      if (e.target.files?.[0]) void choose(e.target.files[0]);
                    }}
                  />
                </div>
              </div>
            )}
            <fieldset disabled={busy}>
              <legend className="sr-only">Opciones del póster</legend>
              <details className="tool-section" open={step === 1}>
                <summary>Formato y tamaño</summary>
                <Field label="Papel">
                  <select
                    value={config.paper}
                    onChange={(e) =>
                      update({ paper: e.target.value as PosterConfig["paper"] })
                    }
                  >
                    {Object.entries(PAPERS).map(([key, p]) => (
                      <option key={key} value={key}>
                        {p.label} · {p.width} × {p.height} mm
                      </option>
                    ))}
                    <option value="custom">Personalizado</option>
                  </select>
                </Field>
                {config.paper === "custom" && (
                  <div className="two-fields">
                    {number(
                      "Ancho papel (mm)",
                      config.customWidth,
                      (n) => update({ customWidth: n }),
                      100,
                      1000,
                      0.1,
                    )}
                    {number(
                      "Alto papel (mm)",
                      config.customHeight,
                      (n) => update({ customHeight: n }),
                      100,
                      1000,
                      0.1,
                    )}
                  </div>
                )}
                <Field label="Orientación">
                  <select
                    value={config.orientation}
                    onChange={(e) =>
                      update({
                        orientation: e.target
                          .value as PosterConfig["orientation"],
                      })
                    }
                  >
                    <option value="portrait">Vertical</option>
                    <option value="landscape">Horizontal</option>
                  </select>
                </Field>
                <div className="two-fields">
                  {number(
                    "Hojas de ancho",
                    l?.columns || config.columns,
                    (n) =>
                      update({
                        sizing: "grid",
                        columns: n,
                        rows: l?.rows || config.rows,
                      }),
                    1,
                    200,
                  )}
                  {number(
                    "Hojas de alto",
                    l?.rows || config.rows,
                    (n) =>
                      update({
                        sizing: "grid",
                        rows: n,
                        columns: l?.columns || config.columns,
                      }),
                    1,
                    200,
                  )}
                </div>
                <Field label="Unidades">
                  <select
                    value={config.units}
                    onChange={(e) =>
                      update({ units: e.target.value as PosterConfig["units"] })
                    }
                  >
                    <option value="mm">Milímetros</option>
                    <option value="cm">Centímetros</option>
                    <option value="in">Pulgadas</option>
                  </select>
                </Field>
                <div className="grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-end gap-[10px]">
                  {number(
                    `Ancho final (${config.units})`,
                    fromMm(l?.poster.width || config.width, config.units),
                    (n) => exact("width", n),
                    0.1,
                    20000,
                    0.01,
                  )}
                  <IconToggle
                    compact
                    checked={lockAspect}
                    onChange={setLockAspect}
                  >
                    Mantener proporción del póster
                  </IconToggle>
                  {number(
                    `Alto final (${config.units})`,
                    fromMm(l?.poster.height || config.height, config.units),
                    (n) => exact("height", n),
                    0.1,
                    20000,
                    0.01,
                  )}
                </div>
              </details>
              <details open={step === 1}>
                <summary>Márgenes y unión</summary>
                <div className="two-fields">
                  {number(
                    "Margen (mm)",
                    config.margin,
                    (n) => update({ margin: n }),
                    0,
                    100,
                    0.5,
                  )}
                  {number(
                    "Solapamiento (mm)",
                    config.overlap,
                    (n) => update({ overlap: n }),
                    0,
                    100,
                    0.5,
                  )}
                </div>
                <p className="control-hint">
                  El margen queda sin imprimir. El solapamiento repite una
                  franja para pegar las hojas.
                </p>
              </details>
              <details open={step === 1}>
                <summary>Imagen y encuadre</summary>
                <Field label="Ajuste">
                  <select
                    value={config.fit}
                    onChange={(e) =>
                      update({ fit: e.target.value as PosterConfig["fit"] })
                    }
                  >
                    <option value="contain">Contener · imagen completa</option>
                    <option value="cover">Cubrir · llenar el póster</option>
                    <option value="manual">Recorte manual</option>
                  </select>
                </Field>
                {config.fit === "manual" && (
                  <>
                    <div className="my-[3px] mb-[15px] flex items-center justify-between gap-2 text-[10px] text-[#7d879a]">
                      <span className="inline-flex items-center gap-1">
                        <FiMove aria-hidden="true" /> Arrastra la imagen en la
                        vista previa
                      </span>
                      <Button
                        type="button"
                        variant="quiet"
                        className="min-h-[30px] whitespace-nowrap px-[7px] py-[5px] text-[10px]"
                        onClick={() =>
                          update({
                            crop: { x: 0.5, y: 0.5, zoom: 1, rotation: 0 },
                          })
                        }
                      >
                        <FiRefreshCw aria-hidden="true" /> Restablecer encuadre
                      </Button>
                    </div>
                    <Field label="Zoom del recorte">
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="0.01"
                        value={config.crop.zoom}
                        onChange={(e) =>
                          update({
                            crop: { ...config.crop, zoom: +e.target.value },
                          })
                        }
                      />
                    </Field>
                    <Field label="Posición horizontal">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={config.crop.x}
                        onChange={(e) =>
                          update({
                            crop: { ...config.crop, x: +e.target.value },
                          })
                        }
                      />
                    </Field>
                    <Field label="Posición vertical">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={config.crop.y}
                        onChange={(e) =>
                          update({
                            crop: { ...config.crop, y: +e.target.value },
                          })
                        }
                      />
                    </Field>
                    <p className="control-hint">
                      Arrastra la imagen en la vista completa o usa los
                      controles con el teclado.
                    </p>
                  </>
                )}
                <Field label="Modo de imagen">
                  <select
                    value={config.effect}
                    onChange={(e) =>
                      update({
                        effect: e.target.value as PosterConfig["effect"],
                      })
                    }
                  >
                    <option value="color">Color original</option>
                    <option value="grayscale">Escala de grises</option>
                    <option value="threshold">
                      Blanco y negro · alto contraste
                    </option>
                  </select>
                </Field>
                <Field label="Fondo">
                  <select
                    value={
                      ["#ffffff", "#000000", "transparent"].includes(
                        config.background,
                      )
                        ? config.background
                        : "custom"
                    }
                    onChange={(e) =>
                      update({
                        background:
                          e.target.value === "custom"
                            ? "#dce4f0"
                            : e.target.value,
                      })
                    }
                  >
                    <option value="#ffffff">Blanco</option>
                    <option value="#000000">Negro</option>
                    <option value="transparent">
                      Transparente (sin tinta)
                    </option>
                    <option value="custom">Color personalizado</option>
                  </select>
                </Field>
                {!["#ffffff", "#000000", "transparent"].includes(
                  config.background,
                ) && (
                  <Field label="Color del fondo">
                    <input
                      type="color"
                      value={config.background}
                      onChange={(e) => update({ background: e.target.value })}
                    />
                  </Field>
                )}
              </details>
              <details>
                <summary>Guías de montaje</summary>
                {(
                  Object.entries({
                    cuts: "Marcas de corte",
                    joins: "Guías de unión",
                    labels: "Etiquetas de posición",
                    numbers: "Número de página",
                    arrows: "Flechas de orientación",
                  }) as [keyof PosterConfig["guides"], string][]
                ).map(([key, label]) => (
                  <label className="check-field" key={key}>
                    <input
                      type="checkbox"
                      checked={config.guides[key]}
                      onChange={(e) =>
                        update({
                          guides: { ...config.guides, [key]: e.target.checked },
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </details>
              <details>
                <summary>Calibración y extras</summary>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={config.calibrationEnabled}
                    onChange={(e) =>
                      update({ calibrationEnabled: e.target.checked })
                    }
                  />
                  Aplicar calibración ({config.calibration.toFixed(4)}×)
                </label>
                <Link to="/calibration">
                  Calibrar impresora <ArrowRight size={12} />
                </Link>
                <p className="control-hint">
                  Corrección uniforme de escala; solo se aplica al activarla.
                </p>
                <div className="premium-feature">
                  <button disabled>Efectos de semitono · próximamente</button>
                  <PremiumBadge />
                </div>
              </details>
            </fieldset>
            <div className="save-project">
              <Field label="Nombre del proyecto">
                <input
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              {root?.user ? (
                <Button
                  onClick={save}
                  variant="secondary"
                  disabled={saving || busy || !l}
                >
                  <FiSave aria-hidden="true" />
                  {saving ? "Guardando…" : "Guardar proyecto"}
                </Button>
              ) : (
                <Link
                  className="btn btn-secondary"
                  to="/login?returnTo=%2Feditor"
                >
                  <FiSave aria-hidden="true" />
                  Inicia sesión para guardar
                </Link>
              )}
              <small>Se guarda la configuración, no tu imagen.</small>
            </div>
          </aside>
          <section className="preview-panel">
            <div className="preview-toolbar">
              <div className="segmented">
                <button
                  aria-pressed={page === null}
                  onClick={() => setPage(null)}
                >
                  Póster completo
                </button>
                <button aria-pressed={page !== null} onClick={() => setPage(0)}>
                  Por página
                </button>
              </div>
              <div className="zoom-controls">
                <Button
                  variant="quiet"
                  aria-label="Alejar"
                  onClick={() => setZoom(Math.max(50, zoom - 25))}
                >
                  <FiZoomOut aria-hidden="true" />
                </Button>
                <span>{zoom}%</span>
                <Button
                  variant="quiet"
                  aria-label="Acercar"
                  onClick={() => setZoom(Math.min(250, zoom + 25))}
                >
                  <FiZoomIn aria-hidden="true" />
                </Button>
                <Button
                  variant="quiet"
                  aria-label="Restablecer zoom"
                  onClick={() => setZoom(100)}
                >
                  <FiRefreshCw aria-hidden="true" />
                </Button>
              </div>
            </div>
            {l && image ? (
              <>
                <div className="preview-surface">
                  <Preview
                    config={config}
                    image={image.url}
                    metadata={image.metadata}
                    page={page}
                    zoom={zoom}
                    onCrop={(x, y) =>
                      update({ crop: { ...config.crop, x, y } })
                    }
                    onRotate={(rotation) =>
                      update({ crop: { ...config.crop, rotation } })
                    }
                  />
                </div>
                {page !== null && (
                  <div className="page-navigation">
                    <Button
                      variant="quiet"
                      disabled={page === 0}
                      onClick={() => setPage(Math.max(0, page - 1))}
                      aria-label="Página anterior"
                    >
                      <ArrowLeft size={16} />
                    </Button>
                    <span>
                      Hoja {l.tiles[Math.min(page, l.tiles.length - 1)].id} ·{" "}
                      {Math.min(page + 1, l.tiles.length)} de {l.tiles.length}
                    </span>
                    <Button
                      variant="quiet"
                      disabled={page >= l.tiles.length - 1}
                      onClick={() =>
                        setPage(Math.min(l.tiles.length - 1, page + 1))
                      }
                      aria-label="Página siguiente"
                    >
                      <ArrowRight size={16} />
                    </Button>
                  </div>
                )}
                <div className="preview-stats">
                  <div>
                    <small>TAMAÑO FINAL</small>
                    <strong>
                      {fromMm(l.poster.width, config.units).toFixed(1)} ×{" "}
                      {fromMm(l.poster.height, config.units).toFixed(1)}{" "}
                      {config.units}
                    </strong>
                  </div>
                  <div>
                    <small>HOJAS</small>
                    <strong>
                      {l.tiles.length}{" "}
                      <span>
                        ({l.columns} × {l.rows})
                      </span>
                    </strong>
                  </div>
                  <div>
                    <small>CALIDAD ESTIMADA</small>
                    <strong>
                      {Math.round(dpi)} DPI · {qualityLabel(dpi)}
                    </strong>
                  </div>
                </div>
                <p className="preview-caption">
                  {page === null
                    ? `${config.fit === "contain" ? "Las zonas blancas forman parte del póster porque la imagen conserva toda su proporción. Usa “Cubrir” si quieres llenar el área y aceptar recorte. " : "La imagen llena el área; las partes fuera del encuadre se recortan. "}Arrastra para moverla. En móvil, usa dos dedos para girarla; en escritorio, Ctrl + rueda. Las franjas azules indican el solapamiento.`
                    : "La zona blanca exterior es el margen no imprimible. Recorta arriba y a la izquierda por las guías de unión."}
                </p>
                {config.fit !== "contain" && (
                  <p className="control-hint px-5">
                    El encuadre recorta las partes de la imagen que quedan fuera
                    del póster.
                  </p>
                )}
                {config.margin < 3 && (
                  <Alert>
                    Con menos de 3 mm de margen se omiten las etiquetas del PDF
                    por falta de espacio. Comprueba que tu impresora admite este
                    margen.
                  </Alert>
                )}
                {dpi < 150 && (
                  <Alert>
                    {qualityLabel(dpi)}: puede apreciarse pixelado de cerca.
                    Para un resultado más nítido, reduce el tamaño o elige una
                    imagen con más píxeles.
                  </Alert>
                )}
              </>
            ) : (
              <div className="preview-empty">
                <ImageIcon size={42} />
                <p>Ajusta la configuración para mostrar la vista previa.</p>
              </div>
            )}
            {overLimit && (
              <Alert>
                Este póster necesita {l?.tiles.length} hojas. Tu límite es{" "}
                {limit}. Reduce el tamaño o{" "}
                <Link to="/premium">consulta Premium</Link>.
              </Alert>
            )}
            {busy ? (
              <div className="export-actions">
                <Progress value={progress} label="Preparando tu PDF" />
                <Button
                  variant="secondary"
                  onClick={() => abort.current?.abort()}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="export-actions">
                <Tooltip text="El PDF mantiene las dimensiones físicas del papel, los márgenes y las franjas de unión.">
                  <span className="control-hint">
                    Hecho para imprimir al 100 %
                  </span>
                </Tooltip>
                {step === 1 ? (
                  <Button
                    disabled={!l || overLimit}
                    onClick={() => {
                      setStep(2);
                      window.scrollTo({ top: 0, behavior: "instant" });
                    }}
                  >
                    Revisar póster <ArrowRight size={18} />
                  </Button>
                ) : (
                  <Button disabled={!l || overLimit} onClick={exportPdf}>
                    <FiDownload aria-hidden="true" />
                    Generar PDF
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
