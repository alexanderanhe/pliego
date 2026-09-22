import {
  useId,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { layout, fitImage, type Tile } from "./math";
import type { PosterConfig, ImageMetadata } from "./schema";
export function Preview({
  config,
  image,
  metadata,
  page,
  zoom,
  onCrop,
  onRotate,
}: {
  config: PosterConfig;
  image: string;
  metadata: ImageMetadata;
  page: number | null;
  zoom: number;
  onCrop: (x: number, y: number) => void;
  onRotate: (rotation: number) => void;
}) {
  const id = useId().replace(/:/g, ""),
    svg = useRef<SVGSVGElement>(null),
    gesture = useRef<{
      pointers: Map<number, { x: number; y: number }>;
      origin: { x: number; y: number };
      startCrop: { x: number; y: number };
      startRotation: number;
      startPair?: [{ x: number; y: number }, { x: number; y: number }];
      startAngle?: number;
      startCenter?: { x: number; y: number };
    } | null>(null);
  const l = layout(config),
    placed = fitImage(metadata, l.poster, config.fit, config.crop),
    tile = page === null ? null : l.tiles[Math.min(page, l.tiles.length - 1)];
  const completeView = {
    width:
      (l.columns - 1) * (l.area.width - config.overlap) +
      l.area.width +
      config.margin * 2,
    height:
      (l.rows - 1) * (l.area.height - config.overlap) +
      l.area.height +
      config.margin * 2,
  };
  const view = tile ? l.paper : completeView;
  const interactionView = tile ? l.paper : l.poster;
  const renderImage = (t: Tile | null) => {
    const x = t
        ? config.margin + (placed.x - t.x) * l.factor
        : config.margin + placed.x,
      y = t
        ? config.margin + (placed.y - t.y) * l.factor
        : config.margin + placed.y;
    return (
      <g
        transform={`rotate(${config.crop.rotation} ${x + (placed.width * (t ? l.factor : 1)) / 2} ${y + (placed.height * (t ? l.factor : 1)) / 2})`}
      >
        <image
          href={image}
          x={x}
          y={y}
          width={placed.width * (t ? l.factor : 1)}
          height={placed.height * (t ? l.factor : 1)}
          preserveAspectRatio="none"
          filter={config.effect === "color" ? undefined : `url(#${id}-effect)`}
        />
      </g>
    );
  };
  function beginGesture(event: ReactPointerEvent<HTMLButtonElement>) {
    if (page !== null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    const current = gesture.current;
    if (!current) {
      gesture.current = {
        pointers: new Map([[event.pointerId, point]]),
        origin: point,
        startCrop: { x: config.crop.x, y: config.crop.y },
        startRotation: config.crop.rotation,
      };
      return;
    }
    current.pointers.set(event.pointerId, point);
    if (current.pointers.size === 2) {
      const pair = [...current.pointers.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      current.startPair = pair;
      current.startCenter = {
        x: (pair[0].x + pair[1].x) / 2,
        y: (pair[0].y + pair[1].y) / 2,
      };
      current.startAngle = Math.atan2(
        pair[1].y - pair[0].y,
        pair[1].x - pair[0].x,
      );
      current.startCrop = { x: config.crop.x, y: config.crop.y };
      current.startRotation = config.crop.rotation;
    }
  }
  function moveGesture(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || !svg.current || !current.pointers.has(event.pointerId))
      return;
    current.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const rect = svg.current.getBoundingClientRect();
    if (current.pointers.size === 1) {
      const dx =
        ((event.clientX - current.origin.x) * interactionView.width) /
        rect.width;
      const dy =
        ((event.clientY - current.origin.y) * interactionView.height) /
        rect.height;
      onCrop(
        Math.max(
          0,
          Math.min(
            1,
            current.startCrop.x + dx / (l.poster.width - placed.width || 1),
          ),
        ),
        Math.max(
          0,
          Math.min(
            1,
            current.startCrop.y + dy / (l.poster.height - placed.height || 1),
          ),
        ),
      );
      return;
    }
    const pair = [...current.pointers.values()] as [
      { x: number; y: number },
      { x: number; y: number },
    ];
    const center = {
      x: (pair[0].x + pair[1].x) / 2,
      y: (pair[0].y + pair[1].y) / 2,
    };
    const dx =
      ((center.x - (current.startCenter?.x ?? center.x)) *
        interactionView.width) /
      rect.width;
    const dy =
      ((center.y - (current.startCenter?.y ?? center.y)) *
        interactionView.height) /
      rect.height;
    const angle =
      Math.atan2(pair[1].y - pair[0].y, pair[1].x - pair[0].x) -
      (current.startAngle ?? 0);
    onCrop(
      Math.max(
        0,
        Math.min(
          1,
          current.startCrop.x + dx / (l.poster.width - placed.width || 1),
        ),
      ),
      Math.max(
        0,
        Math.min(
          1,
          current.startCrop.y + dy / (l.poster.height - placed.height || 1),
        ),
      ),
    );
    onRotate(
      Math.max(
        -180,
        Math.min(180, current.startRotation + (angle * 180) / Math.PI),
      ),
    );
  }
  function endGesture(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current) return;
    current.pointers.delete(event.pointerId);
    if (current.pointers.size === 1) {
      const remaining = [...current.pointers.values()][0];
      current.origin = remaining;
      current.startCrop = { x: config.crop.x, y: config.crop.y };
    } else if (current.pointers.size === 0) gesture.current = null;
  }
  function rotateWithWheel(event: ReactWheelEvent<HTMLButtonElement>) {
    if (!event.ctrlKey || page !== null) return;
    event.preventDefault();
    onRotate(
      Math.max(-180, Math.min(180, config.crop.rotation - event.deltaY * 0.12)),
    );
  }
  return (
    <div className="preview-scroll">
      <div
        className="preview-stage"
        style={{
          width: "min(100%, 680px)",
          transform: `scale(${zoom / 100})`,
          transformOrigin: "center center",
        }}
      >
        <svg
          ref={svg}
          role="img"
          aria-label={
            tile
              ? `Hoja ${tile.id}. Recorta los bordes superior e izquierdo indicados; conserva los opuestos para unir.`
              : "Vista previa del póster completo y solapamientos"
          }
          viewBox={`0 0 ${view.width} ${view.height}`}
          style={{
            width: "100%",
            maxWidth: "none",
            maxHeight: undefined,
            height: "auto",
            aspectRatio: `${view.width} / ${view.height}`,
            background: tile
              ? "white"
              : config.background === "transparent"
                ? "#f0f0f0"
                : config.background,
            touchAction: "none",
          }}
        >
          <defs>
            <clipPath id={`${id}-clip`}>
              <rect
                x={tile ? config.margin : config.margin}
                y={tile ? config.margin : config.margin}
                width={tile ? tile.width * l.factor : l.poster.width}
                height={tile ? tile.height * l.factor : l.poster.height}
              />
            </clipPath>
            <filter id={`${id}-effect`} colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0"
              />
              {config.effect === "threshold" && (
                <feComponentTransfer>
                  <feFuncR type="discrete" tableValues="0 1" />
                  <feFuncG type="discrete" tableValues="0 1" />
                  <feFuncB type="discrete" tableValues="0 1" />
                </feComponentTransfer>
              )}
            </filter>
          </defs>
          {!tile && (
            <g>
              <rect
                x={0}
                y={0}
                width={view.width}
                height={view.height}
                fill="#e9edf3"
              />
              {l.tiles.map((t) => (
                <rect
                  key={`sheet-${t.id}`}
                  x={t.x - config.margin}
                  y={t.y - config.margin}
                  width={l.area.width + config.margin * 2}
                  height={l.area.height + config.margin * 2}
                  fill="#ffffff"
                  stroke="#d8dee9"
                  strokeWidth={0.55}
                />
              ))}
            </g>
          )}
          <g clipPath={`url(#${id}-clip)`}>
            <rect
              x={config.margin}
              y={config.margin}
              width={tile ? tile.width * l.factor : l.poster.width}
              height={tile ? tile.height * l.factor : l.poster.height}
              fill={
                config.background === "transparent" ? "none" : config.background
              }
            />
            {renderImage(tile)}
          </g>
          {tile ? (
            <g fill="none" stroke="#4056d6" strokeWidth={0.4}>
              {config.guides.cuts && (
                <rect
                  x={config.margin}
                  y={config.margin}
                  width={tile.width * l.factor}
                  height={tile.height * l.factor}
                  strokeDasharray="2 1"
                />
              )}
              {config.guides.joins && tile.column > 0 && (
                <path
                  d={`M${config.margin + config.overlap * l.factor} ${config.margin}v${tile.height * l.factor}`}
                  strokeDasharray="2 2"
                />
              )}
              {config.guides.joins && tile.row > 0 && (
                <path
                  d={`M${config.margin} ${config.margin + config.overlap * l.factor}h${tile.width * l.factor}`}
                  strokeDasharray="2 2"
                />
              )}
              <text
                x={config.margin}
                y={l.paper.height - 2}
                fill="#18213a"
                stroke="none"
                fontSize={2.5}
              >
                {config.guides.labels ? tile.id : ""}{" "}
                {config.guides.numbers
                  ? `${tile.index + 1}/${l.tiles.length}`
                  : ""}{" "}
                {config.guides.arrows ? "↑ ARRIBA" : ""}
              </text>
            </g>
          ) : (
            <g transform={`translate(${config.margin} ${config.margin})`}>
              {l.tiles.map((t) => (
                <g key={t.id}>
                  <rect
                    x={t.x}
                    y={t.y}
                    width={t.width}
                    height={t.height}
                    fill="none"
                    stroke="#b9c6f2"
                    strokeWidth={0.55}
                    strokeDasharray="2 1.5"
                  />
                  {t.column > 0 && (
                    <rect
                      x={t.x}
                      y={t.y}
                      width={config.overlap}
                      height={l.area.height}
                      fill="#4056d6"
                      fillOpacity={0.12}
                    />
                  )}{" "}
                  {t.row > 0 && (
                    <rect
                      x={t.x}
                      y={t.y}
                      width={l.area.width}
                      height={config.overlap}
                      fill="#4056d6"
                      fillOpacity={0.12}
                    />
                  )}
                  <rect
                    x={t.x + 3}
                    y={t.y + 3}
                    width={13}
                    height={9}
                    fill="white"
                    rx={1}
                  />
                  <text x={t.x + 5} y={t.y + 9} fontSize={5} fill="#263354">
                    {t.id}
                  </text>
                </g>
              ))}
            </g>
          )}
        </svg>
        {page === null && (
          <CropDragSurface
            onPointerDown={beginGesture}
            onPointerMove={moveGesture}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            onWheel={rotateWithWheel}
          />
        )}
      </div>
    </div>
  );
}

function CropDragSurface({
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onWheel,
}: {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onWheel: (event: ReactWheelEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className="crop-drag-surface"
      type="button"
      aria-label="Arrastra para mover la imagen. Usa dos dedos para rotarla."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onWheel={onWheel}
    />
  );
}
