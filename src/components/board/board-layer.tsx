"use client";

import { useId } from "react";

import { BoardMarkdown } from "@/components/board/board-markdown";
import {
  ARROW_WIDTH_PX,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GRID,
  arrowGeometry,
  colorCss,
  themeForFill,
  type BoardArrow,
  type BoardContent,
  type BoardElement,
} from "@/lib/boards";
import { cn } from "@/lib/utils";

/** Le dessin d'un panneau, sans aucun geste : l'aperçu d'une fiche le montre
 *  réduit, l'éditeur pose ses poignées par-dessus. Les deux passent par ici,
 *  pour qu'une note ait la même allure partout. */

/** La trame du panneau : un point tous les pas de grille. Elle dit où tombera
 *  un élément déplacé au clavier ; ce n'est pas un décor. */
export function BoardGrid() {
  // Plusieurs aperçus se côtoient sur une fiche : chacun nomme sa trame.
  const id = `trame-${useId().replace(/:/g, "")}`;
  return (
    <svg
      width={BOARD_WIDTH}
      height={BOARD_HEIGHT}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0"
    >
      <defs>
        <pattern id={id} width={GRID} height={GRID} patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="1.5" height="1.5" className="fill-rule" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={BOARD_WIDTH} height={BOARD_HEIGHT} fill={`url(#${id})`} />
    </svg>
  );
}

/** Le corps d'un élément : ce qu'il montre, sans son cadre de sélection. Il
 *  porte le thème de son fond quand ce fond est une couleur libre
 *  (`themeForFill`). */
export function ElementBody({ element, links }: { element: BoardElement; links: boolean }) {
  return (
    <div
      className="absolute inset-0"
      data-theme={themeForFill(element.fill)}
      data-element-body={element.id}
    >
      <ElementShape element={element} links={links} />
    </div>
  );
}

function ElementShape({ element, links }: { element: BoardElement; links: boolean }) {
  const stroke = colorCss("stroke", element.stroke);
  const ink = colorCss("ink", element.ink);
  // Une note sans fond ne se lirait plus sur la trame : elle garde le vélin.
  const fill =
    element.kind === "note" && element.fill === "aucun" ? "var(--surface)" : colorCss("fill", element.fill);

  switch (element.kind) {
    case "note":
      return (
        <div
          className="absolute inset-0 overflow-hidden border border-rule px-[18px] pb-4 pt-[26px]"
          style={{ background: fill, color: ink }}
        >
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-2 -ml-1.5 size-3 rounded-full"
            style={{ background: stroke }}
          />
          <BoardMarkdown text={element.text} size={element.size} links={links} />
        </div>
      );
    case "texte":
      return (
        <div
          className={cn("absolute inset-0 overflow-hidden", element.fill !== "aucun" && "px-4 py-3")}
          style={{ background: fill, color: ink }}
        >
          <BoardMarkdown text={element.text} size={element.size} links={links} />
        </div>
      );
    case "triangle":
      return (
        <>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute inset-0 overflow-visible"
          >
            <polygon
              points="50,1 99,99 1,99"
              vectorEffect="non-scaling-stroke"
              style={{ fill, stroke, strokeWidth: 2 }}
            />
          </svg>
          <span
            className="absolute inset-x-[22%] bottom-3 whitespace-pre-wrap text-center leading-[1.4]"
            style={{ fontSize: element.size, color: ink }}
          >
            {element.text}
          </span>
        </>
      );
    default:
      return (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center overflow-hidden whitespace-pre-wrap border-2 text-center leading-[1.4]",
            element.kind === "rond" ? "rounded-[50%] p-4" : "p-2",
          )}
          style={{ background: fill, borderColor: stroke, color: ink, fontSize: element.size }}
        >
          {element.text}
        </div>
      );
  }
}

/** Les traits des flèches, en un seul calque sous les éléments. */
export function ArrowStrokes({
  content,
  selectedId,
  onArrowPointerDown,
}: {
  content: BoardContent;
  selectedId?: string | null;
  onArrowPointerDown?: (arrow: BoardArrow, event: React.PointerEvent) => void;
}) {
  const byId = new Map(content.elements.map((element) => [element.id, element]));
  return (
    <svg
      width={BOARD_WIDTH}
      height={BOARD_HEIGHT}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
    >
      {content.arrows.map((arrow) => {
        const from = byId.get(arrow.from);
        const to = byId.get(arrow.to);
        if (!from || !to) return null;
        const geometry = arrowGeometry(from, to, arrow);
        const color = colorCss("stroke", arrow.color);
        const width = ARROW_WIDTH_PX[arrow.width];
        const selected = selectedId === arrow.id;
        return (
          <g key={arrow.id}>
            {selected ? (
              <line
                x1={geometry.start.x}
                y1={geometry.start.y}
                x2={geometry.end.x}
                y2={geometry.end.y}
                className="stroke-gold"
                strokeOpacity={0.35}
                strokeWidth={width + 8}
              />
            ) : null}
            <line
              x1={geometry.lineStart.x}
              y1={geometry.lineStart.y}
              x2={geometry.lineEnd.x}
              y2={geometry.lineEnd.y}
              style={{ stroke: color }}
              strokeWidth={width}
              strokeDasharray={arrow.dash === "tirets" ? "8 6" : undefined}
            />
            {geometry.headEnd ? <polygon points={geometry.headEnd} style={{ fill: color }} /> : null}
            {geometry.headStart ? <polygon points={geometry.headStart} style={{ fill: color }} /> : null}
            {onArrowPointerDown ? (
              <line
                x1={geometry.start.x}
                y1={geometry.start.y}
                x2={geometry.end.x}
                y2={geometry.end.y}
                stroke="transparent"
                strokeWidth={16}
                className="cursor-pointer"
                style={{ pointerEvents: "stroke" }}
                onPointerDown={(event) => onArrowPointerDown(arrow, event)}
              />
            ) : null}
            {selected ? (
              <>
                <rect x={geometry.start.x - 4.5} y={geometry.start.y - 4.5} width={9} height={9} className="fill-surface stroke-gold" />
                <rect x={geometry.end.x - 4.5} y={geometry.end.y - 4.5} width={9} height={9} className="fill-surface stroke-gold" />
              </>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** La légende d'une flèche, posée en son milieu. */
export function ArrowLabel({ label, selected }: { label: string; selected?: boolean }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap border bg-ground px-2 py-0.5 meta text-ink-body",
        selected ? "border-gold" : "border-rule",
      )}
    >
      {label}
    </span>
  );
}

/** Tout le panneau, en lecture seule. L'aperçu n'a pas de trame : réduite,
 *  elle ne dit plus où tombe un élément, et son bord se verrait dans le cadre. */
export function StaticBoard({ content, links }: { content: BoardContent; links: boolean }) {
  const byId = new Map(content.elements.map((element) => [element.id, element]));
  return (
    <div className="relative" style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}>
      <ArrowStrokes content={content} />
      {content.elements.map((element) => (
        <div
          key={element.id}
          className="pointer-events-none absolute"
          style={{ left: element.x, top: element.y, width: element.w, height: element.h }}
        >
          <ElementBody element={element} links={links} />
        </div>
      ))}
      {content.arrows.map((arrow) => {
        const from = byId.get(arrow.from);
        const to = byId.get(arrow.to);
        if (!arrow.label || !from || !to) return null;
        const { middle } = arrowGeometry(from, to, arrow);
        return (
          <div
            key={arrow.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: middle.x, top: middle.y }}
          >
            <ArrowLabel label={arrow.label} />
          </div>
        );
      })}
    </div>
  );
}
