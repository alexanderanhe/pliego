import {
  useEffect,
  useRef,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { Link } from "react-router";
import { X, ArrowUpRight } from "lucide-react";
import { FiChevronsUp, FiLink, FiLink2 } from "react-icons/fi";
export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
}) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ScrubNumber({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const drag = useRef<{ y: number; value: number } | null>(null);
  const clamp = (next: number) =>
    Math.min(max, Math.max(min, Number(next.toFixed(6))));
  const dragIncrement = Math.max(step, 0.1);
  return (
    <label className="relative block min-w-0 pt-2">
      <span className="absolute left-2 top-0 z-[1] bg-white px-1 text-[11px] font-semibold text-[#48546b]">
        {label}
      </span>
      <input
        type="number"
        className="[appearance:textfield] pr-7 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={Number(value.toFixed(3))}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(clamp(next));
        }}
      />
      <button
        type="button"
        className="absolute bottom-[7px] right-1 grid h-7 w-6 place-items-center rounded text-[#8b95a8] hover:bg-[#eef1fb] hover:text-[#4056d6] focus-visible:outline-2 focus-visible:outline-[#7586f4]"
        aria-label={`Arrastra verticalmente para cambiar ${label}`}
        title="Arrastra arriba o abajo para ajustar"
        onPointerDown={(event) => {
          drag.current = { y: event.clientY, value };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const delta = Math.trunc((drag.current.y - event.clientY) / 12);
          onChange(clamp(drag.current.value + delta * dragIncrement));
        }}
        onPointerUp={(event) => {
          drag.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <FiChevronsUp aria-hidden="true" />
      </button>
    </label>
  );
}
export function Alert({ children }: { children: ReactNode }) {
  return (
    <div className="alert" role="status" aria-live="polite">
      {children}
    </div>
  );
}
export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div aria-live="polite">
      <p>
        {label} · {Math.round(value * 100)} %
      </p>
      <progress max={1} value={value} aria-label={label} />
    </div>
  );
}
export function Tooltip({
  children,
  text,
}: {
  children: ReactNode;
  text: string;
}) {
  return (
    <span className="tooltip">
      {children}
      <span role="tooltip">{text}</span>
    </span>
  );
}
export function PremiumBadge() {
  return (
    <Link to="/premium" className="premium-badge">
      Premium <ArrowUpRight size={13} />
    </Link>
  );
}
export function IconToggle({
  checked,
  onChange,
  children,
  compact = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <label
      className={
        compact
          ? "relative mb-[7px] grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#d8def0] bg-[#4056d6] p-0 text-white hover:bg-[#3145bd]"
          : "relative my-1 grid grid-cols-[25px_1fr_auto] items-center gap-[9px] rounded-[7px] border border-[#e1e6f2] bg-[#f4f6fc] px-[11px] py-[10px] text-[11px] text-[#4c5870]"
      }
      title={checked ? "Mantener proporción" : "Permitir proporción libre"}
    >
      <input
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:inset-0 focus-visible:z-10 focus-visible:opacity-0"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        className={
          compact
            ? "text-[14px]"
            : "grid h-[25px] w-[25px] place-items-center rounded-md bg-[#4056d6] text-[15px] text-white"
        }
        aria-hidden="true"
      >
        {checked ? <FiLink2 /> : <FiLink />}
      </span>
      <span className={compact ? "sr-only" : ""}>{children}</span>
      <small className={compact ? "sr-only" : "text-[9px] text-[#7d89a2]"}>
        {checked ? "Bloqueada" : "Libre"}
      </small>
    </label>
  );
}
export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog ref={ref} onCancel={onClose} aria-label={title}>
      <div className="flex items-center justify-between gap-6">
        <h2>{title}</h2>
        <Button variant="quiet" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
