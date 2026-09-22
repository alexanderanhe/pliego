import { useRef, useState } from "react";
import { Upload, ArrowRight, ImagePlus } from "lucide-react";
export function UploadArea({
  onFile,
  compact = false,
  busy = false,
}: {
  onFile: (file: File) => void;
  compact?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null),
    [drag, setDrag] = useState(false);
  return (
    <div
      className={`upload-area ${compact ? "compact" : ""} ${drag ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label="Subir imagen"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <span className="upload-icon">
        <ImagePlus size={24} />
      </span>
      <h3>{compact ? "Elige tu imagen" : "Aquí empieza algo grande"}</h3>
      <p>Arrastra una imagen o selecciónala desde tu dispositivo</p>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        <Upload size={17} />
        {busy ? "Procesando…" : "Subir una imagen"}
        <ArrowRight size={17} />
      </button>
      <small>JPG, PNG o WebP · Hasta 40 MB · Sin subirla a un servidor</small>
    </div>
  );
}
