"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";

import { ArrowLabel, ArrowStrokes, BoardGrid, ElementBody } from "@/components/board/board-layer";
import { BoardInspector } from "@/components/board/board-inspector";
import {
  ARROW_DEFAULTS,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  ELEMENT_DEFAULTS,
  ELEMENT_KIND_LABELS,
  ELEMENT_MAX,
  ELEMENT_MIN,
  GRID,
  arrowGeometry,
  contentBounds,
  elementName,
  newItemId,
  type ArrowPatch,
  type BoardArrow,
  type BoardContent,
  type BoardElement,
  type BoardOperation,
  type BoardOwner,
  type ElementKind,
  type ElementPatch,
} from "@/lib/boards";
import { cn } from "@/lib/utils";
import { boardOperationAction, readBoardContentAction } from "@/server/actions/boards";

/** L'éditeur d'un panneau.
 *
 *  Chaque geste s'applique ici d'abord, puis part au serveur comme une
 *  opération (`BoardOperation`) : la note suit la souris sans attendre le
 *  réseau, et deux membres qui travaillent ensemble ne s'écrasent pas — chaque
 *  opération ne touche que l'élément qu'elle nomme. Si le serveur en refuse une,
 *  il renvoie le panneau tel qu'il est, et l'éditeur s'y range.
 *
 *  L'historique garde, pour chaque geste, l'opération et son inverse. Annuler
 *  une suppression **rétablit** l'élément depuis la corbeille du panneau, avec
 *  son auteur ; le reposer l'attribuerait à celui qui annule. */

type Me = { id: string; name: string };
type Tool = "select" | ElementKind | "fleche";
type Selection = { type: "element" | "arrow"; id: string } | null;
type View = { x: number; y: number; zoom: number };

type State = {
  content: BoardContent;
  /** Ce qui a été retiré pendant la séance, pour le rétablir tel quel. */
  trash: Record<string, { element: BoardElement; arrows: BoardArrow[] }>;
  trashArrows: Record<string, BoardArrow>;
};

type Entry = { forward: BoardOperation[]; backward: BoardOperation[] };

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
const SETTLE_MS = 700;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function applyOp(state: State, op: BoardOperation, me: Me): State {
  const { elements, arrows } = state.content;
  const content = (next: Partial<BoardContent>) => ({ ...state.content, ...next });
  const maxZ = elements.reduce((max, one) => Math.max(max, one.z), 0);

  switch (op.type) {
    case "poser":
      if (elements.some((one) => one.id === op.element.id)) return state;
      return {
        ...state,
        content: content({
          elements: [
            ...elements,
            {
              ...op.element,
              z: maxZ + 1,
              authorId: me.id,
              authorName: me.name,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      };
    case "modifier":
      return {
        ...state,
        content: content({
          elements: elements.map((one) => (one.id === op.id ? { ...one, ...op.patch } : one)),
        }),
      };
    case "plan": {
      const minZ = elements.reduce((min, one) => Math.min(min, one.z), 0);
      const z = op.sens === "avant" ? maxZ + 1 : minZ - 1;
      return {
        ...state,
        content: content({
          elements: elements
            .map((one) => (one.id === op.id ? { ...one, z } : one))
            .sort((a, b) => a.z - b.z),
        }),
      };
    }
    case "retirer": {
      const element = elements.find((one) => one.id === op.id);
      if (!element) return state;
      const attached = arrows.filter((arrow) => arrow.from === op.id || arrow.to === op.id);
      return {
        ...state,
        content: content({
          elements: elements.filter((one) => one.id !== op.id),
          arrows: arrows.filter((arrow) => !attached.includes(arrow)),
        }),
        trash: { ...state.trash, [op.id]: { element, arrows: attached } },
      };
    }
    case "retablir": {
      const saved = state.trash[op.id];
      if (!saved || elements.some((one) => one.id === op.id)) return state;
      const present = new Set([...elements.map((one) => one.id), op.id]);
      const back = saved.arrows.filter(
        (arrow) =>
          present.has(arrow.from) && present.has(arrow.to) && !arrows.some((one) => one.id === arrow.id),
      );
      const trash = { ...state.trash };
      delete trash[op.id];
      return {
        ...state,
        content: content({
          elements: [...elements, saved.element].sort((a, b) => a.z - b.z),
          arrows: [...arrows, ...back],
        }),
        trash,
      };
    }
    case "relier":
      if (arrows.some((one) => one.id === op.arrow.id)) return state;
      return {
        ...state,
        content: content({
          arrows: [
            ...arrows,
            {
              ...ARROW_DEFAULTS,
              ...op.arrow,
              authorId: me.id,
              authorName: me.name,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      };
    case "modifier-fleche":
      return {
        ...state,
        content: content({
          arrows: arrows.map((one) => (one.id === op.id ? { ...one, ...op.patch } : one)),
        }),
      };
    case "retirer-fleche": {
      const arrow = arrows.find((one) => one.id === op.id);
      if (!arrow) return state;
      return {
        ...state,
        content: content({ arrows: arrows.filter((one) => one.id !== op.id) }),
        trashArrows: { ...state.trashArrows, [op.id]: arrow },
      };
    }
    case "retablir-fleche": {
      const arrow = state.trashArrows[op.id];
      if (!arrow || arrows.some((one) => one.id === op.id)) return state;
      const trashArrows = { ...state.trashArrows };
      delete trashArrows[op.id];
      return { ...state, content: content({ arrows: [...arrows, arrow] }), trashArrows };
    }
  }
}

type Action = { type: "op"; op: BoardOperation; me: Me } | { type: "reset"; content: BoardContent };

function reducer(state: State, action: Action): State {
  if (action.type === "reset") return { content: action.content, trash: {}, trashArrows: {} };
  return applyOp(state, action.op, action.me);
}

/** Ce qu'on refait après l'avoir annulé : un élément posé puis annulé est à la
 *  corbeille, on le rétablit plutôt que de le reposer. */
function redoOf(op: BoardOperation): BoardOperation {
  if (op.type === "poser") return { type: "retablir", id: op.element.id };
  if (op.type === "relier") return { type: "retablir-fleche", id: op.arrow.id };
  return op;
}

function pickKeys<T extends object>(source: T, keys: string[]): Partial<T> {
  const picked: Record<string, unknown> = {};
  for (const key of keys) picked[key] = (source as Record<string, unknown>)[key];
  return picked as Partial<T>;
}

type Gesture =
  | { mode: "pan"; startX: number; startY: number; view: View; moved: boolean }
  | {
      mode: "move" | "resize";
      id: string;
      dir: string;
      startX: number;
      startY: number;
      origin: Pick<BoardElement, "x" | "y" | "w" | "h">;
      moved: boolean;
    };

type Draft = {
  type: "element" | "arrow";
  id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

const HANDLES = [
  { dir: "nw", left: "0%", top: "0%", cursor: "cursor-nwse-resize" },
  { dir: "n", left: "50%", top: "0%", cursor: "cursor-ns-resize" },
  { dir: "ne", left: "100%", top: "0%", cursor: "cursor-nesw-resize" },
  { dir: "e", left: "100%", top: "50%", cursor: "cursor-ew-resize" },
  { dir: "se", left: "100%", top: "100%", cursor: "cursor-nwse-resize" },
  { dir: "s", left: "50%", top: "100%", cursor: "cursor-ns-resize" },
  { dir: "sw", left: "0%", top: "100%", cursor: "cursor-nesw-resize" },
  { dir: "w", left: "0%", top: "50%", cursor: "cursor-ew-resize" },
];

const TOOLS: { tool: Tool; label: string; glyph: React.ReactNode }[] = [
  { tool: "select", label: "Sélection", glyph: <path d="M6 3l12 8-5.5 1.2L10 18z" strokeLinejoin="round" /> },
  { tool: "note", label: "Note", glyph: <path d="M4 4h16v11l-5 5H4zM15 20v-5h5" strokeLinejoin="round" /> },
  { tool: "texte", label: "Bloc de texte", glyph: <path d="M5 7V4h14v3M12 4v16M9 20h6" /> },
  { tool: "carre", label: "Carré", glyph: <rect x="4" y="4" width="16" height="16" /> },
  { tool: "rond", label: "Rond", glyph: <circle cx="12" cy="12" r="8.5" /> },
  { tool: "triangle", label: "Triangle", glyph: <path d="M12 4l9 16H3z" strokeLinejoin="round" /> },
  { tool: "fleche", label: "Flèche entre deux éléments", glyph: <path d="M4 20L19 5M11 5h8v8" /> },
];

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      {children}
    </svg>
  );
}

export function BoardEditor({
  boardId,
  initialContent,
  me,
  ownerType,
  canWrite,
  canModerate,
  canReport,
  facts,
  initialElementId,
}: {
  boardId: string;
  initialContent: BoardContent;
  me: Me | null;
  ownerType: BoardOwner;
  /** Poser sur le panneau. */
  canWrite: boolean;
  /** Toucher à ce que les autres ont posé : sur un panneau de lieu, l'équipe. */
  canModerate: boolean;
  canReport: boolean;
  facts: { label: string; value: string }[];
  /** L'élément à montrer à l'ouverture — celui qu'un signalement désigne. */
  initialElementId?: string | null;
}) {
  const [state, dispatch] = useReducer(reducer, {
    content: initialContent,
    trash: {},
    trashArrows: {},
  });
  // Les gestes lisent l'état au moment où ils se terminent, pas celui du
  // rendu où ils ont commencé.
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });

  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<Selection>(
    initialElementId && initialContent.elements.some((one) => one.id === initialElementId)
      ? { type: "element", id: initialElementId }
      : null,
  );
  const [pending, setPending] = useState<string | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 });
  const viewRef = useRef(view);
  useLayoutEffect(() => {
    viewRef.current = view;
  });
  const [framed, setFramed] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyCounts, setHistoryCounts] = useState({ undo: 0, redo: 0 });

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const history = useRef<{ undo: Entry[]; redo: Entry[] }>({ undo: [], redo: [] });
  const queue = useRef<BoardOperation[]>([]);
  const sending = useRef(false);
  const draft = useRef<Draft | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { elements, arrows } = state.content;
  const selectedElement =
    selection?.type === "element" ? (elements.find((one) => one.id === selection.id) ?? null) : null;
  const selectedArrow =
    selection?.type === "arrow" ? (arrows.find((one) => one.id === selection.id) ?? null) : null;

  const canModify = useCallback(
    (authorId: string) =>
      Boolean(me) && canWrite && (ownerType === "groupe" || canModerate || authorId === me?.id),
    [me, canWrite, ownerType, canModerate],
  );

  const syncHistory = useCallback(
    () =>
      setHistoryCounts({ undo: history.current.undo.length, redo: history.current.redo.length }),
    [],
  );

  /* --- L'envoi ------------------------------------------------------------ */

  const flush = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    setSaving(true);
    while (queue.current.length > 0) {
      const op = queue.current.shift()!;
      let result;
      try {
        result = await boardOperationAction(boardId, op);
      } catch {
        result = { ok: false as const, message: "Le serveur ne répond pas : la modification n'a pas été enregistrée." };
      }
      if (!result.ok) {
        queue.current = [];
        setError(result.message);
        if (result.content) {
          dispatch({ type: "reset", content: result.content });
          history.current = { undo: [], redo: [] };
          syncHistory();
        }
        break;
      }
    }
    sending.current = false;
    setSaving(false);
  }, [boardId, syncHistory]);

  const send = useCallback(
    (op: BoardOperation) => {
      const last = queue.current.at(-1);
      // Deux retouches du même élément qui attendent encore leur tour partent
      // ensemble : une rafale de flèches du clavier ne fait qu'un aller-retour.
      if (last && op.type === "modifier" && last.type === "modifier" && last.id === op.id) {
        last.patch = { ...last.patch, ...op.patch };
      } else if (
        last &&
        op.type === "modifier-fleche" &&
        last.type === "modifier-fleche" &&
        last.id === op.id
      ) {
        last.patch = { ...last.patch, ...op.patch };
      } else {
        queue.current.push(structuredClone(op));
      }
      setError(null);
      void flush();
    },
    [flush],
  );

  const apply = useCallback(
    (op: BoardOperation) => {
      if (!me) return;
      dispatch({ type: "op", op, me });
      send(op);
    },
    [me, send],
  );

  /** Un geste : ses opérations partent, et son inverse entre à l'historique. */
  const perform = useCallback(
    (forward: BoardOperation[], backward: BoardOperation[]) => {
      forward.forEach(apply);
      history.current.undo.push({ forward, backward });
      if (history.current.undo.length > 100) history.current.undo.shift();
      history.current.redo = [];
      syncHistory();
    },
    [apply, syncHistory],
  );

  /** Ce qui change en continu — une frappe, un nuancier — s'applique ici tout
   *  de suite et ne part qu'à l'arrêt, en un seul geste d'historique. */
  const settle = useCallback(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = null;
    const current = draft.current;
    draft.current = null;
    if (!current) return;
    const changed = Object.keys(current.after).filter((key) => current.after[key] !== current.before[key]);
    if (changed.length === 0) return;
    const after = pickKeys(current.after, changed);
    const before = pickKeys(current.before, changed);
    if (current.type === "element") {
      send({ type: "modifier", id: current.id, patch: after as ElementPatch });
      history.current.undo.push({
        forward: [{ type: "modifier", id: current.id, patch: after as ElementPatch }],
        backward: [{ type: "modifier", id: current.id, patch: before as ElementPatch }],
      });
    } else {
      send({ type: "modifier-fleche", id: current.id, patch: after as ArrowPatch });
      history.current.undo.push({
        forward: [{ type: "modifier-fleche", id: current.id, patch: after as ArrowPatch }],
        backward: [{ type: "modifier-fleche", id: current.id, patch: before as ArrowPatch }],
      });
    }
    history.current.redo = [];
    syncHistory();
  }, [send, syncHistory]);

  const live = useCallback(
    (type: "element" | "arrow", id: string, patch: Record<string, unknown>) => {
      if (!me) return;
      if (draft.current && (draft.current.type !== type || draft.current.id !== id)) settle();
      const source =
        type === "element"
          ? stateRef.current.content.elements.find((one) => one.id === id)
          : stateRef.current.content.arrows.find((one) => one.id === id);
      if (!source) return;
      if (!draft.current) draft.current = { type, id, before: {}, after: {} };
      for (const key of Object.keys(patch)) {
        if (!(key in draft.current.before)) {
          draft.current.before[key] = (source as Record<string, unknown>)[key];
        }
      }
      Object.assign(draft.current.after, patch);
      dispatch({
        type: "op",
        op:
          type === "element"
            ? { type: "modifier", id, patch: patch as ElementPatch }
            : { type: "modifier-fleche", id, patch: patch as ArrowPatch },
        me,
      });
      if (draftTimer.current) clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(settle, SETTLE_MS);
    },
    [me, settle],
  );

  // Quitter la page avec une frappe en attente : elle part quand même.
  useEffect(() => () => settle(), [settle]);

  const undo = useCallback(() => {
    settle();
    const entry = history.current.undo.pop();
    if (!entry) return;
    entry.backward.forEach(apply);
    history.current.redo.push(entry);
    syncHistory();
  }, [apply, settle, syncHistory]);

  const redo = useCallback(() => {
    settle();
    const entry = history.current.redo.pop();
    if (!entry) return;
    entry.forward.map(redoOf).forEach(apply);
    history.current.undo.push(entry);
    syncHistory();
  }, [apply, settle, syncHistory]);

  /* --- Ce qu'on voit ------------------------------------------------------ */

  const frame = useCallback((target: { x: number; y: number; w: number; h: number } | null, maxZoom = 1) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!target) {
      setView({ x: GRID * 2, y: GRID * 2, zoom: 1 });
      return;
    }
    const zoom = clamp(Math.min(maxZoom, width / target.w, height / target.h), ZOOM_MIN, ZOOM_MAX);
    setView({
      x: (width - target.w * zoom) / 2 - target.x * zoom,
      y: (height - target.h * zoom) / 2 - target.y * zoom,
      zoom,
    });
  }, []);

  // L'éditeur s'ouvre cadré sur ce que porte le panneau — ou sur l'élément
  // qu'on est venu voir. À la vue par défaut, un panneau rempli ailleurs qu'en
  // haut à gauche paraîtrait vide.
  // Le cadre se calcule une fois la zone mesurée ; le panneau reste invisible
  // d'ici là, plutôt que de sauter de la vue par défaut à la sienne.
  useEffect(() => {
    const request = requestAnimationFrame(() => {
      const target = initialElementId
        ? initialContent.elements.find((one) => one.id === initialElementId)
        : null;
      frame(target ? contentBounds([target], 120) : contentBounds(initialContent.elements));
      setFramed(true);
    });
    return () => cancelAnimationFrame(request);
    // L'ouverture seulement : ensuite, c'est le lecteur qui cadre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomAround = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = (clientX ?? rect.left + rect.width / 2) - rect.left;
    const py = (clientY ?? rect.top + rect.height / 2) - rect.top;
    setView((current) => {
      const zoom = clamp(current.zoom * factor, ZOOM_MIN, ZOOM_MAX);
      const ratio = zoom / current.zoom;
      return { zoom, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
    });
  }, []);

  // La molette fait défiler le panneau ; avec Ctrl (ou le pincement d'un pavé
  // tactile, que le navigateur rapporte ainsi), elle zoome sous le curseur.
  // L'écouteur est posé à la main : React le rendrait passif, et la page
  // défilerait avec le panneau.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        zoomAround(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
      } else {
        setView((current) => ({ ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }));
      }
    }
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoomAround]);

  // Revenir sur l'onglet : le panneau a pu bouger entre-temps. On le relit —
  // sauf si l'on a soi-même des gestes en route, qu'on écraserait.
  useEffect(() => {
    async function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (sending.current || queue.current.length > 0 || draft.current || gesture.current) return;
      const content = await readBoardContentAction(boardId);
      if (content && !sending.current && queue.current.length === 0 && !draft.current) {
        dispatch({ type: "reset", content });
        history.current = { undo: [], redo: [] };
        syncHistory();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [boardId, syncHistory]);

  // Annuler et rétablir au clavier. L'écoute est posée sur le document : après
  // une suppression, l'élément qui avait le focus n'existe plus, et le focus
  // retombe sur la page, hors de l'éditeur. Un champ de saisie garde son propre
  // historique, et une modale ouverte n'est pas le panneau.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (!mod || (key !== "z" && key !== "y")) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true'], [role='dialog'], [role='alertdialog']")) return;
      if (target && target !== document.body && !rootRef.current?.contains(target)) return;
      event.preventDefault();
      if (key === "y" || event.shiftKey) redo();
      else undo();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  function toBoard(clientX: number, clientY: number) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - viewRef.current.x) / viewRef.current.zoom,
      y: (clientY - rect.top - viewRef.current.y) / viewRef.current.zoom,
    };
  }

  /* --- Les gestes --------------------------------------------------------- */

  function select(next: Selection) {
    settle();
    setJustCreated(null);
    setSelection(next);
  }

  function create(kind: ElementKind, clientX: number, clientY: number) {
    const point = toBoard(clientX, clientY);
    const defaults = ELEMENT_DEFAULTS[kind];
    const element = {
      id: newItemId(),
      kind,
      ...defaults,
      x: clamp(Math.round((point.x - defaults.w / 2) / GRID) * GRID, 0, BOARD_WIDTH - defaults.w),
      y: clamp(Math.round((point.y - defaults.h / 2) / GRID) * GRID, 0, BOARD_HEIGHT - defaults.h),
    };
    perform([{ type: "poser", element }], [{ type: "retirer", id: element.id }]);
    setSelection({ type: "element", id: element.id });
    setJustCreated(element.id);
    setTool("select");
  }

  function link(id: string) {
    if (!pending) {
      setPending(id);
      setSelection(null);
      return;
    }
    if (pending === id) {
      setPending(null);
      return;
    }
    const from = pending;
    setPending(null);
    setTool("select");
    const exists = arrows.some(
      (arrow) => (arrow.from === from && arrow.to === id) || (arrow.from === id && arrow.to === from),
    );
    if (exists) return;
    const arrow = { id: newItemId(), from, to: id };
    perform([{ type: "relier", arrow }], [{ type: "retirer-fleche", id: arrow.id }]);
    setSelection({ type: "arrow", id: arrow.id });
  }

  function onCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (tool !== "select" && tool !== "fleche") {
      if (canWrite) create(tool, event.clientX, event.clientY);
      return;
    }
    if (tool === "fleche") {
      setPending(null);
      return;
    }
    gesture.current = { mode: "pan", startX: event.clientX, startY: event.clientY, view, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onCanvasPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    if (!current || !me) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    current.moved = true;

    if (current.mode === "pan") {
      setView({ ...current.view, x: current.view.x + dx, y: current.view.y + dy });
      return;
    }

    const bx = dx / viewRef.current.zoom;
    const by = dy / viewRef.current.zoom;
    const { origin } = current;
    let patch: ElementPatch;
    if (current.mode === "move") {
      patch = {
        x: Math.round(clamp(origin.x + bx, 0, BOARD_WIDTH - origin.w)),
        y: Math.round(clamp(origin.y + by, 0, BOARD_HEIGHT - origin.h)),
      };
    } else {
      let { x, y, w, h } = origin;
      if (current.dir.includes("e")) w = clamp(origin.w + bx, ELEMENT_MIN, ELEMENT_MAX);
      if (current.dir.includes("s")) h = clamp(origin.h + by, ELEMENT_MIN, ELEMENT_MAX);
      if (current.dir.includes("w")) {
        w = clamp(origin.w - bx, ELEMENT_MIN, Math.min(ELEMENT_MAX, origin.x + origin.w));
        x = origin.x + origin.w - w;
      }
      if (current.dir.includes("n")) {
        h = clamp(origin.h - by, ELEMENT_MIN, Math.min(ELEMENT_MAX, origin.y + origin.h));
        y = origin.y + origin.h - h;
      }
      patch = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    }
    dispatch({ type: "op", op: { type: "modifier", id: current.id, patch }, me });
  }

  function onCanvasPointerUp() {
    const current = gesture.current;
    gesture.current = null;
    if (!current) return;
    if (current.mode === "pan") {
      if (!current.moved) select(null);
      return;
    }
    if (!current.moved) return;
    const element = stateRef.current.content.elements.find((one) => one.id === current.id);
    if (!element) return;
    const keys = current.mode === "move" ? ["x", "y"] : ["x", "y", "w", "h"];
    perform(
      [{ type: "modifier", id: current.id, patch: pickKeys(element, keys) as ElementPatch }],
      [{ type: "modifier", id: current.id, patch: pickKeys(current.origin, keys) as ElementPatch }],
    );
  }

  function onElementPointerDown(element: BoardElement, event: React.PointerEvent) {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (tool === "fleche") {
      if (canWrite) link(element.id);
      return;
    }
    if (tool !== "select") setTool("select");
    if (selection?.type !== "element" || selection.id !== element.id) select({ type: "element", id: element.id });
    if (!canModify(element.authorId)) return;
    gesture.current = {
      mode: "move",
      id: element.id,
      dir: "",
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: element.x, y: element.y, w: element.w, h: element.h },
      moved: false,
    };
    canvasRef.current?.setPointerCapture(event.pointerId);
  }

  function onHandlePointerDown(element: BoardElement, dir: string, event: React.PointerEvent) {
    if (event.button !== 0) return;
    event.stopPropagation();
    gesture.current = {
      mode: "resize",
      id: element.id,
      dir,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: element.x, y: element.y, w: element.w, h: element.h },
      moved: false,
    };
    canvasRef.current?.setPointerCapture(event.pointerId);
  }

  function onArrowPointerDown(arrow: BoardArrow, event: React.PointerEvent) {
    if (event.button !== 0 || tool !== "select") return;
    event.stopPropagation();
    select({ type: "arrow", id: arrow.id });
  }

  /** Au clavier : les flèches déplacent d'un pas de grille, `Maj` d'un dixième,
   *  `Alt` redimensionne ; `Suppr` retire, `Échap` relâche. */
  function onElementKeyDown(element: BoardElement, event: React.KeyboardEvent) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const move = moves[event.key];
    if (event.key === "Escape") {
      select(null);
      setPending(null);
      return;
    }
    if (!canModify(element.authorId)) return;
    if (move) {
      event.preventDefault();
      const step = event.shiftKey ? GRID / 10 : GRID;
      const keys = event.altKey ? ["w", "h"] : ["x", "y"];
      const patch: ElementPatch = event.altKey
        ? {
            w: clamp(element.w + move[0] * step, ELEMENT_MIN, ELEMENT_MAX),
            h: clamp(element.h + move[1] * step, ELEMENT_MIN, ELEMENT_MAX),
          }
        : {
            x: clamp(element.x + move[0] * step, 0, BOARD_WIDTH - element.w),
            y: clamp(element.y + move[1] * step, 0, BOARD_HEIGHT - element.h),
          };
      perform(
        [{ type: "modifier", id: element.id, patch }],
        [{ type: "modifier", id: element.id, patch: pickKeys(element, keys) as ElementPatch }],
      );
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeSelected(element.id);
    }
  }

  function removeSelected(id: string) {
    perform([{ type: "retirer", id }], [{ type: "retablir", id }]);
    setSelection(null);
  }

  function removeArrow(id: string) {
    perform([{ type: "retirer-fleche", id }], [{ type: "retablir-fleche", id }]);
    setSelection(null);
  }

  /* --- L'inspecteur ------------------------------------------------------- */

  const elementActions = {
    live: (patch: ElementPatch) => selectedElement && live("element", selectedElement.id, patch),
    settle,
    commit: (patch: ElementPatch) => {
      if (!selectedElement) return;
      settle();
      perform(
        [{ type: "modifier", id: selectedElement.id, patch }],
        [
          {
            type: "modifier",
            id: selectedElement.id,
            patch: pickKeys(selectedElement, Object.keys(patch)) as ElementPatch,
          },
        ],
      );
    },
  };

  const arrowActions = {
    live: (patch: ArrowPatch) => selectedArrow && live("arrow", selectedArrow.id, patch),
    settle,
    commit: (patch: ArrowPatch) => {
      if (!selectedArrow) return;
      settle();
      perform(
        [{ type: "modifier-fleche", id: selectedArrow.id, patch }],
        [
          {
            type: "modifier-fleche",
            id: selectedArrow.id,
            patch: pickKeys(selectedArrow, Object.keys(patch)) as ArrowPatch,
          },
        ],
      );
    },
  };

  function duplicate() {
    if (!selectedElement) return;
    settle();
    const { kind, w, h, text, size, stroke, fill, ink } = selectedElement;
    const element = {
      id: newItemId(),
      kind,
      w,
      h,
      text,
      size,
      stroke,
      fill,
      ink,
      x: clamp(selectedElement.x + GRID, 0, BOARD_WIDTH - w),
      y: clamp(selectedElement.y + GRID, 0, BOARD_HEIGHT - h),
    };
    perform([{ type: "poser", element }], [{ type: "retirer", id: element.id }]);
    setSelection({ type: "element", id: element.id });
  }

  function reverseArrow() {
    if (!selectedArrow) return;
    // Inverser, c'est relier dans l'autre sens : la flèche garde son style.
    const { id, from, to, color, heads, dash, width, label } = selectedArrow;
    const reversed = { id: newItemId(), from: to, to: from, color, heads, dash, width, label };
    perform(
      [{ type: "retirer-fleche", id }, { type: "relier", arrow: reversed }],
      [{ type: "retirer-fleche", id: reversed.id }, { type: "retablir-fleche", id }],
    );
    setSelection({ type: "arrow", id: reversed.id });
  }

  const pendingElement = pending ? elements.find((one) => one.id === pending) : null;
  const creating = tool !== "select" && tool !== "fleche";
  const byId = new Map(elements.map((element) => [element.id, element]));
  const selectedCanModify = selectedElement
    ? canModify(selectedElement.authorId)
    : selectedArrow
      ? canModify(selectedArrow.authorId)
      : false;

  return (
    <div ref={rootRef} className="flex flex-col lg:h-full lg:min-h-0 lg:flex-row">
      <div className="relative h-[60dvh] min-h-[320px] overflow-hidden bg-ground lg:h-auto lg:min-w-0 lg:flex-1">
        <div
          ref={canvasRef}
          className={cn(
            "absolute inset-0 touch-none select-none overflow-hidden",
            creating || tool === "fleche" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
          )}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
        >
          <div
            className={cn("absolute left-0 top-0 origin-top-left", !framed && "invisible")}
            style={{
              width: BOARD_WIDTH,
              height: BOARD_HEIGHT,
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
            }}
          >
            <div aria-hidden="true" className="absolute inset-0 border border-rule" />
            <BoardGrid />
            <ArrowStrokes
              content={state.content}
              selectedId={selectedArrow?.id ?? null}
              onArrowPointerDown={onArrowPointerDown}
            />

            {elements.map((element) => {
              const selected = selectedElement?.id === element.id;
              const editable = canModify(element.authorId);
              return (
                <div
                  key={element.id}
                  className={cn(
                    "absolute",
                    tool === "fleche" ? "cursor-pointer" : creating ? "cursor-crosshair" : editable ? "cursor-grab" : "cursor-pointer",
                  )}
                  style={{ left: element.x, top: element.y, width: element.w, height: element.h }}
                  onPointerDown={(event) => onElementPointerDown(element, event)}
                >
                  <button
                    type="button"
                    aria-label={`${ELEMENT_KIND_LABELS[element.kind]} : ${elementName(element)}`}
                    aria-pressed={selected}
                    onClick={(event) => {
                      // Un clic de souris a déjà été traité au pointeur. Seule
                      // l'activation au clavier arrive ici sans position.
                      if (event.detail !== 0) return;
                      if (tool === "fleche") link(element.id);
                      else select({ type: "element", id: element.id });
                    }}
                    onKeyDown={(event) => onElementKeyDown(element, event)}
                    className="absolute inset-0 cursor-[inherit] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
                  />
                  <div className="pointer-events-none absolute inset-0">
                    <ElementBody element={element} links={!editable} />
                  </div>
                  {pending === element.id ? (
                    <span aria-hidden="true" className="pointer-events-none absolute -inset-[7px] border-2 border-dashed border-crimson" />
                  ) : null}
                  {selected ? (
                    <span aria-hidden="true" className="pointer-events-none absolute -inset-[7px] border border-gold">
                      {editable
                        ? HANDLES.map((handle) => (
                            <span
                              key={handle.dir}
                              className={cn(
                                "pointer-events-auto absolute -ml-[9px] -mt-[9px] flex size-[18px] touch-none items-center justify-center",
                                handle.cursor,
                              )}
                              style={{ left: handle.left, top: handle.top }}
                              onPointerDown={(event) => onHandlePointerDown(element, handle.dir, event)}
                            >
                              <span className="size-[9px] border border-gold bg-surface" />
                            </span>
                          ))
                        : null}
                    </span>
                  ) : null}
                </div>
              );
            })}

            {arrows.map((arrow) => {
              const from = byId.get(arrow.from);
              const to = byId.get(arrow.to);
              if (!from || !to) return null;
              const { middle } = arrowGeometry(from, to, arrow);
              const selected = selectedArrow?.id === arrow.id;
              return (
                <button
                  key={arrow.id}
                  type="button"
                  aria-label={`Flèche de « ${elementName(from)} » vers « ${elementName(to)} »${arrow.label ? ` : ${arrow.label}` : ""}`}
                  aria-pressed={selected}
                  onPointerDown={(event) => onArrowPointerDown(arrow, event)}
                  onClick={(event) => {
                    if (event.detail === 0) select({ type: "arrow", id: arrow.id });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") select(null);
                    if ((event.key === "Delete" || event.key === "Backspace") && canModify(arrow.authorId)) {
                      event.preventDefault();
                      removeArrow(arrow.id);
                    }
                  }}
                  className="absolute flex min-h-tap min-w-tap -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:outline-gold"
                  style={{ left: middle.x, top: middle.y }}
                >
                  {arrow.label ? <ArrowLabel label={arrow.label} selected={selected} /> : null}
                </button>
              );
            })}
          </div>
        </div>

        {canWrite ? (
          <div
            role="toolbar"
            aria-label="Outils du panneau"
            className="absolute inset-x-3 bottom-3 flex gap-1 overflow-x-auto border-2 border-gold bg-surface p-1.5 lg:inset-x-auto lg:bottom-auto lg:left-4 lg:top-4 lg:flex-col"
          >
            {TOOLS.map((one) => (
              <button
                key={one.tool}
                type="button"
                aria-label={one.label}
                title={one.label}
                aria-pressed={tool === one.tool}
                onClick={() => {
                  settle();
                  setTool(one.tool);
                  setPending(null);
                  if (one.tool !== "select") setSelection(null);
                }}
                className={cn(
                  "flex size-tap shrink-0 items-center justify-center border",
                  tool === one.tool
                    ? "border-gold bg-surface-selected text-gold-ink"
                    : "border-transparent text-ink-body hover:bg-surface-selected",
                )}
              >
                <Glyph>{one.glyph}</Glyph>
              </button>
            ))}
            <span aria-hidden="true" className="mx-1 w-px shrink-0 bg-hairline lg:mx-1 lg:my-1 lg:h-px lg:w-auto" />
            <button
              type="button"
              aria-label="Annuler le dernier geste"
              title="Annuler (Ctrl+Z)"
              disabled={historyCounts.undo === 0}
              onClick={undo}
              className="flex size-tap shrink-0 items-center justify-center text-ink-body hover:bg-surface-selected disabled:opacity-40"
            >
              <Glyph>
                <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
              </Glyph>
            </button>
            <button
              type="button"
              aria-label="Rétablir le geste annulé"
              title="Rétablir (Ctrl+Maj+Z)"
              disabled={historyCounts.redo === 0}
              onClick={redo}
              className="flex size-tap shrink-0 items-center justify-center text-ink-body hover:bg-surface-selected disabled:opacity-40"
            >
              <Glyph>
                <path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" />
              </Glyph>
            </button>
          </div>
        ) : null}

        {tool === "fleche" ? (
          <div
            role="status"
            className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 border-2 border-gold bg-surface py-0 pl-4 pr-1"
          >
            <span className="button-label text-gold-ink">
              {pendingElement
                ? `RELIER « ${elementName(pendingElement).toLocaleUpperCase("fr-FR")} » À…`
                : "CHOISIR LE DÉPART"}
            </span>
            <button
              type="button"
              onClick={() => {
                setTool("select");
                setPending(null);
              }}
              className="min-h-tap px-3 button-label text-ink-body hover:bg-surface-selected"
            >
              ANNULER
            </button>
          </div>
        ) : null}

        <div
          role="group"
          aria-label="Zoom"
          className="absolute right-3 top-3 flex items-center border border-rule bg-surface lg:bottom-4 lg:left-4 lg:right-auto lg:top-auto"
        >
          <button
            type="button"
            aria-label="Dézoomer"
            onClick={() => zoomAround(1 / 1.25)}
            className="flex size-tap items-center justify-center text-ink-body hover:bg-surface-selected"
          >
            <Glyph>
              <path d="M5 12h14" />
            </Glyph>
          </button>
          <button
            type="button"
            aria-label="Cadrer sur le panneau"
            title="Cadrer sur le panneau"
            onClick={() => frame(contentBounds(elements))}
            className="min-h-tap min-w-16 border-x border-hairline px-2 text-[16px] text-ink hover:bg-surface-selected"
          >
            {Math.round(view.zoom * 100)} %
          </button>
          <button
            type="button"
            aria-label="Zoomer"
            onClick={() => zoomAround(1.25)}
            className="flex size-tap items-center justify-center text-ink-body hover:bg-surface-selected"
          >
            <Glyph>
              <path d="M5 12h14M12 5v14" />
            </Glyph>
          </button>
        </div>
      </div>

      <aside
        aria-label="Propriétés"
        className="flex flex-col gap-5 border-t-2 border-rule bg-surface p-6 lg:w-[340px] lg:shrink-0 lg:overflow-y-auto lg:border-l-2 lg:border-t-0"
      >
        {error ? (
          <p role="alert" className="border border-crimson bg-surface-inset p-3 caption text-crimson-ink">
            {error}
          </p>
        ) : null}
        <p role="status" className="sr-only">
          {saving ? "Enregistrement en cours." : ""}
        </p>
        <BoardInspector
          element={selectedElement}
          arrow={selectedArrow}
          elements={elements}
          facts={[
            ...facts,
            { label: "Éléments", value: String(elements.length) },
            { label: "Flèches", value: String(arrows.length) },
          ]}
          canModify={selectedCanModify}
          canReport={canReport && Boolean(selectedElement) && selectedElement?.authorId !== me?.id}
          autoFocusText={justCreated !== null && justCreated === selectedElement?.id}
          elementActions={elementActions}
          arrowActions={arrowActions}
          onFront={() =>
            selectedElement &&
            perform(
              [{ type: "plan", id: selectedElement.id, sens: "avant" }],
              [{ type: "plan", id: selectedElement.id, sens: "arriere" }],
            )
          }
          onBack={() =>
            selectedElement &&
            perform(
              [{ type: "plan", id: selectedElement.id, sens: "arriere" }],
              [{ type: "plan", id: selectedElement.id, sens: "avant" }],
            )
          }
          onDuplicate={duplicate}
          onRemove={() => {
            if (selectedElement) removeSelected(selectedElement.id);
            else if (selectedArrow) removeArrow(selectedArrow.id);
          }}
          onReverse={reverseArrow}
        />
        {saving ? <p className="caption text-ink-muted">Enregistrement…</p> : null}
      </aside>
    </div>
  );
}
