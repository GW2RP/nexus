"use client";

import { BoardTextField } from "@/components/board/board-text-field";
import { ReportDialog } from "@/components/report-dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import {
  ARROW_DASHES,
  ARROW_DASH_LABELS,
  ARROW_HEADS,
  ARROW_HEAD_LABELS,
  ARROW_WIDTHS,
  ARROW_WIDTH_LABELS,
  ELEMENT_KIND_LABELS,
  LEGEND_MAX,
  ARROW_LABEL_MAX,
  PALETTES,
  TEXT_SIZES,
  colorCss,
  contrastRatio,
  elementName,
  isHexColor,
  isRichKind,
  type ArrowPatch,
  type BoardArrow,
  type BoardElement,
  type ElementPatch,
  type Palette,
} from "@/lib/boards";
import { formatLongDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** La colonne de droite de l'éditeur : ce qu'on sait de l'élément choisi, et
 *  ce qu'on peut y changer. Rien de choisi, elle présente le panneau.
 *
 *  Deux façons d'écrire : `live` pour ce qui change en continu — une frappe, le
 *  glissé d'un nuancier —, qui s'enregistre quand on s'arrête ; `commit` pour
 *  un choix franc, enregistré tout de suite. Les deux passent par l'historique. */

export type InspectorActions<P> = {
  live: (patch: P) => void;
  settle: () => void;
  commit: (patch: P) => void;
};

type Fact = { label: string; value: string };

export function BoardInspector({
  element,
  arrow,
  elements,
  facts,
  canModify,
  canReport,
  autoFocusText,
  elementActions,
  arrowActions,
  onFront,
  onBack,
  onDuplicate,
  onRemove,
  onReverse,
}: {
  element: BoardElement | null;
  arrow: BoardArrow | null;
  elements: BoardElement[];
  facts: Fact[];
  canModify: boolean;
  canReport: boolean;
  autoFocusText: boolean;
  elementActions: InspectorActions<ElementPatch>;
  arrowActions: InspectorActions<ArrowPatch>;
  onFront: () => void;
  onBack: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onReverse: () => void;
}) {
  if (element) {
    return (
      <ElementPanel
        element={element}
        canModify={canModify}
        canReport={canReport}
        autoFocusText={autoFocusText}
        actions={elementActions}
        onFront={onFront}
        onBack={onBack}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
      />
    );
  }

  if (arrow) {
    const from = elements.find((one) => one.id === arrow.from);
    const to = elements.find((one) => one.id === arrow.to);
    return (
      <ArrowPanel
        arrow={arrow}
        title={`${from ? elementName(from) : "…"} → ${to ? elementName(to) : "…"}`}
        canModify={canModify}
        actions={arrowActions}
        onReverse={onReverse}
        onRemove={onRemove}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="eyebrow text-gold-eyebrow">LE PANNEAU</p>
      <dl className="flex flex-col">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex items-baseline justify-between gap-4 border-b border-hairline py-3 last:border-b-0"
          >
            <dt className="text-[16px] text-ink-muted">{fact.label}</dt>
            <dd className="text-right text-[17px] text-ink">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Heading({
  eyebrow,
  title,
  author,
  createdAt,
}: {
  eyebrow: string;
  title: string;
  author: string | null;
  createdAt: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="eyebrow text-gold-eyebrow">{eyebrow.toLocaleUpperCase("fr-FR")}</p>
      <h2 className="mt-1 break-words panel-title">{title}</h2>
      <p className="meta text-ink-muted">
        {author ? `Posé par ${author}` : "Posé par un compte supprimé"} · le{" "}
        {formatLongDate(new Date(createdAt))}
      </p>
    </div>
  );
}

function ElementPanel({
  element,
  canModify,
  canReport,
  autoFocusText,
  actions,
  onFront,
  onBack,
  onDuplicate,
  onRemove,
}: {
  element: BoardElement;
  canModify: boolean;
  canReport: boolean;
  autoFocusText: boolean;
  actions: InspectorActions<ElementPatch>;
  onFront: () => void;
  onBack: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const rich = isRichKind(element.kind);
  const sizeIndex = TEXT_SIZES.indexOf(element.size as (typeof TEXT_SIZES)[number]);

  const report = canReport ? (
    <ReportDialog
      targetType="element-panneau"
      targetId={element.id}
      label={`Signaler l'élément « ${elementName(element)} »`}
      withLabel
      className="self-start px-0"
    />
  ) : null;

  const heading = (
    <Heading
      eyebrow={ELEMENT_KIND_LABELS[element.kind]}
      title={elementName(element)}
      author={element.authorName}
      createdAt={element.createdAt}
    />
  );

  if (!canModify) {
    return (
      <div className="flex flex-col gap-5">
        {heading}
        {report}
      </div>
    );
  }

  const contrast = contrastOf(element);

  return (
    <div className="flex flex-col gap-5">
      {heading}

      {rich ? (
        <BoardTextField
          key={element.id}
          id={`texte-${element.id}`}
          value={element.text}
          autoFocus={autoFocusText}
          onChange={(text) => actions.live({ text })}
          onBlur={actions.settle}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`legende-${element.id}`}>Légende</Label>
          <Input
            id={`legende-${element.id}`}
            value={element.text}
            maxLength={LEGEND_MAX}
            onChange={(event) => actions.live({ text: event.target.value })}
            onBlur={actions.settle}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span id={`taille-${element.id}`} className="meta text-ink-muted">
          Taille du texte
        </span>
        <div
          role="group"
          aria-labelledby={`taille-${element.id}`}
          className="flex self-start border border-rule"
        >
          <button
            type="button"
            aria-label="Réduire le texte"
            disabled={sizeIndex <= 0}
            onClick={() => actions.commit({ size: TEXT_SIZES[sizeIndex - 1] })}
            className="size-tap text-[15px] text-ink-body hover:bg-surface-selected disabled:opacity-40"
          >
            A−
          </button>
          <span
            aria-live="polite"
            className="flex min-w-[76px] items-center justify-center border-x border-hairline text-[17px]"
          >
            {element.size} px
          </span>
          <button
            type="button"
            aria-label="Agrandir le texte"
            disabled={sizeIndex < 0 || sizeIndex >= TEXT_SIZES.length - 1}
            onClick={() => actions.commit({ size: TEXT_SIZES[sizeIndex + 1] })}
            className="size-tap text-[21px] text-ink-body hover:bg-surface-selected disabled:opacity-40"
          >
            A+
          </button>
        </div>
      </div>

      {element.kind === "texte" ? null : (
        <ColorRow
          palette="stroke"
          legend={element.kind === "note" ? "Épingle" : "Trait"}
          value={element.stroke}
          onLive={(stroke) => actions.live({ stroke })}
          onSettle={actions.settle}
          onPick={(stroke) => actions.commit({ stroke })}
        />
      )}
      <ColorRow
        palette="fill"
        legend="Fond"
        value={element.fill}
        exclude={element.kind === "note" ? ["aucun"] : []}
        onLive={(fill) => actions.live({ fill })}
        onSettle={actions.settle}
        onPick={(fill) => actions.commit({ fill })}
      />
      <ColorRow
        palette="ink"
        legend="Texte"
        value={element.ink}
        onLive={(ink) => actions.live({ ink })}
        onSettle={actions.settle}
        onPick={(ink) => actions.commit({ ink })}
      />
      {contrast !== null && contrast < 4.5 ? (
        <p role="status" className="-mt-2 caption text-crimson-ink">
          Contraste {contrast.toFixed(1).replace(".", ",")}:1 : sous le seuil de 4,5:1.
        </p>
      ) : null}

      <div className="h-px bg-hairline" />

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="quiet" size="sm" onClick={onFront}>
          AU PREMIER PLAN
        </Button>
        <Button type="button" variant="quiet" size="sm" onClick={onBack}>
          À L&apos;ARRIÈRE-PLAN
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDuplicate}>
          DUPLIQUER
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onRemove}>
          SUPPRIMER
        </Button>
      </div>
      {report}
    </div>
  );
}

function ArrowPanel({
  arrow,
  title,
  canModify,
  actions,
  onReverse,
  onRemove,
}: {
  arrow: BoardArrow;
  title: string;
  canModify: boolean;
  actions: InspectorActions<ArrowPatch>;
  onReverse: () => void;
  onRemove: () => void;
}) {
  const heading = (
    <Heading eyebrow="Flèche" title={title} author={arrow.authorName} createdAt={arrow.createdAt} />
  );
  if (!canModify) return heading;

  return (
    <div className="flex flex-col gap-5">
      {heading}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`legende-${arrow.id}`}>Légende</Label>
        <Input
          id={`legende-${arrow.id}`}
          value={arrow.label}
          maxLength={ARROW_LABEL_MAX}
          onChange={(event) => actions.live({ label: event.target.value })}
          onBlur={actions.settle}
        />
      </div>

      <ColorRow
        palette="stroke"
        legend="Trait"
        value={arrow.color}
        onLive={(color) => actions.live({ color })}
        onSettle={actions.settle}
        onPick={(color) => actions.commit({ color })}
      />

      <Segmented
        legend="Pointes"
        options={ARROW_HEADS.map((value) => ({
          value,
          label: ARROW_HEAD_LABELS[value],
          content: <HeadGlyph heads={value} />,
        }))}
        value={arrow.heads}
        onPick={(heads) => actions.commit({ heads })}
      />
      <Segmented
        legend="Tracé"
        options={ARROW_DASHES.map((value) => ({
          value,
          label: ARROW_DASH_LABELS[value],
          content: ARROW_DASH_LABELS[value].toLocaleUpperCase("fr-FR"),
        }))}
        value={arrow.dash}
        onPick={(dash) => actions.commit({ dash })}
      />
      <Segmented
        legend="Épaisseur"
        options={ARROW_WIDTHS.map((value) => ({
          value,
          label: ARROW_WIDTH_LABELS[value],
          content: ARROW_WIDTH_LABELS[value].toLocaleUpperCase("fr-FR"),
        }))}
        value={arrow.width}
        onPick={(width) => actions.commit({ width })}
      />

      <div className="h-px bg-hairline" />

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onReverse}>
          INVERSER
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onRemove}>
          SUPPRIMER
        </Button>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  legend,
  options,
  value,
  onPick,
}: {
  legend: string;
  options: { value: T; label: string; content: React.ReactNode }[];
  value: T;
  onPick: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 meta text-ink-muted">{legend}</legend>
      <div
        className="grid border border-rule"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={option.label}
            title={option.label}
            aria-pressed={option.value === value}
            onClick={() => onPick(option.value)}
            className={cn(
              "flex min-h-tap items-center justify-center button-label",
              option.value === value
                ? "bg-surface-selected text-gold-ink"
                : "text-ink-muted hover:bg-surface-selected",
            )}
          >
            {option.content}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function HeadGlyph({ heads }: { heads: BoardArrow["heads"] }) {
  return (
    <svg width="30" height="12" viewBox="0 0 30 12" aria-hidden="true" className="fill-current stroke-current">
      <path d="M3 6h24" strokeWidth="1.5" />
      {heads !== "aucune" ? <path d="M29 6l-7-4v8z" stroke="none" /> : null}
      {heads === "deux" ? <path d="M1 6l7-4v8z" stroke="none" /> : null}
    </svg>
  );
}

/** Une ligne de couleurs : les trois teintes du système, puis la couleur libre.
 *  Une teinte suit le thème ; une couleur libre reste celle qu'on a choisie. */
function ColorRow({
  palette,
  legend,
  value,
  exclude = [],
  onLive,
  onSettle,
  onPick,
}: {
  palette: Palette;
  legend: string;
  value: string;
  exclude?: string[];
  onLive: (value: string) => void;
  onSettle: () => void;
  onPick: (value: string) => void;
}) {
  const custom = isHexColor(value);
  return (
    <fieldset>
      <legend className="mb-2 meta text-ink-muted">
        {legend}
        {custom ? ` · ${value.toLocaleUpperCase("fr-FR")}` : ""}
      </legend>
      <div className="flex flex-wrap gap-2">
        {PALETTES[palette]
          .filter((swatch) => !exclude.includes(swatch.id))
          .map((swatch) => (
            <button
              key={swatch.id}
              type="button"
              aria-label={swatch.label}
              title={swatch.label}
              aria-pressed={value === swatch.id}
              onClick={() => onPick(swatch.id)}
              className={cn(
                "flex size-tap items-center justify-center border-2",
                value === swatch.id ? "border-gold" : "border-transparent",
              )}
            >
              <span
                className="relative block size-6 overflow-hidden border border-rule"
                style={{ background: colorCss(palette, swatch.id) }}
              >
                {swatch.token === null ? (
                  <svg viewBox="0 0 22 22" aria-hidden="true" className="absolute inset-0 size-full">
                    <path d="M0 22L22 0" className="stroke-crimson" strokeWidth="1.3" />
                  </svg>
                ) : null}
              </span>
            </button>
          ))}
        <label
          title="Couleur libre"
          className={cn(
            "relative flex size-tap cursor-pointer items-center justify-center border-2 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-gold",
            custom ? "border-gold" : "border-transparent",
          )}
        >
          <span
            className={cn(
              "flex size-6 items-center justify-center text-ink-muted",
              custom ? "border border-rule" : "border border-dashed border-ink-muted bg-surface-inset",
            )}
            style={custom ? { background: value } : undefined}
          >
            {custom ? null : (
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className="stroke-current" strokeWidth="2">
                <path d="M12 4v16M4 12h16" />
              </svg>
            )}
          </span>
          <input
            type="color"
            aria-label={`Couleur libre : ${legend.toLocaleLowerCase("fr-FR")}`}
            value={custom ? value : resolveHex(palette, value) ?? "#000000"}
            onChange={(event) => onLive(event.target.value)}
            onBlur={onSettle}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
      </div>
    </fieldset>
  );
}

/** La valeur hexadécimale d'une couleur rangée, telle que le thème la rend.
 *  Les teintes du système sont des variables : on les lit sur l'élément
 *  lui-même, qui peut porter un autre thème que la page (`themeForFill`). */
function resolveHex(palette: Palette, value: string, elementId?: string): string | null {
  if (isHexColor(value)) return value;
  if (typeof document === "undefined") return null;
  const swatch = PALETTES[palette].find((one) => one.id === value);
  const token = swatch ? (swatch.token ?? "--ground") : null;
  if (!token) return null;
  const node =
    (elementId && document.querySelector(`[data-element-body="${elementId}"]`)) ||
    document.documentElement;
  const read = getComputedStyle(node).getPropertyValue(token).trim();
  return isHexColor(read) ? read : null;
}

/** Le contraste du texte d'un élément sur son fond. Une note sans fond garde le
 *  vélin ; un bloc sans fond se lit sur le panneau. */
function contrastOf(element: BoardElement): number | null {
  const ink = resolveHex("ink", element.ink, element.id);
  const fill =
    element.kind === "note" && element.fill === "aucun"
      ? resolveHex("fill", "velin", element.id)
      : resolveHex("fill", element.fill, element.id);
  if (!ink || !fill) return null;
  return contrastRatio(ink, fill);
}
