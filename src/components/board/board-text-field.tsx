"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { headingSize } from "@/lib/boards";
import { cn } from "@/lib/utils";

declare module "@tiptap/core" {
  interface Storage {
    markdown: MarkdownStorage;
  }
}

/** Le texte d'une note ou d'un bloc de texte, écrit là où il se lit : dans
 *  l'élément même, sur le panneau.
 *
 *  C'est l'éditeur des fiches (`RichTextField`), réduit à ce qu'un panneau
 *  porte : titre, gras, italique, barré, lien, listes et citation. Pas d'image —
 *  une note se lit d'un coup d'œil — et pas de souligné, qui n'existe pas en
 *  markdown. Le texte part en markdown, comme partout ailleurs.
 *
 *  Un seul éditeur, montré à deux endroits : le texte et son curseur dans
 *  l'élément (`BoardTextContent`), la barre de mise en forme dans l'inspecteur
 *  (`BoardTextToolbar`). Deux champs pour le même texte se disputeraient le
 *  curseur. */

/** L'éditeur du texte d'un élément. Il ne rend rien lui-même : il naît avec
 *  l'élément choisi (`key` chez l'appelant) et se confie à `onEditor`, qui le
 *  donne à l'élément et à l'inspecteur.
 *
 *  Il prend son contenu à la création, puis ne reprend le texte de l'élément
 *  que s'il change sans lui — une annulation depuis la barre d'outils, un
 *  panneau que le serveur renvoie. Ce qu'il a écrit lui-même ne lui revient
 *  pas : relu, il remettrait le curseur au début à chaque frappe. */
export function BoardTextSession({
  id,
  text,
  autoFocus,
  onEditor,
  onChange,
  onBlur,
  onEscape,
}: {
  /** L'élément dont c'est le texte. */
  id: string;
  text: string;
  /** Un élément qu'on vient de poser : on écrit dedans sans le chercher. */
  autoFocus: boolean;
  onEditor: (id: string, editor: Editor | null) => void;
  onChange: (markdown: string) => void;
  onBlur: () => void;
  onEscape: () => void;
}) {
  const handlers = useRef({ onChange, onBlur, onEscape });
  useLayoutEffect(() => {
    handlers.current = { onChange, onBlur, onEscape };
  });
  const written = useRef(text);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [3],
          HTMLAttributes: {
            class: "font-display font-semibold leading-[1.2]",
            style: "font-size: var(--taille-titre)",
          },
        },
        bold: { HTMLAttributes: { class: "font-semibold" } },
        bulletList: { HTMLAttributes: { class: "list-disc pl-[1.2em]" } },
        orderedList: { HTMLAttributes: { class: "list-decimal pl-[1.4em]" } },
        blockquote: { HTMLAttributes: { class: "flex flex-col gap-[0.4em] border-l-2 border-gold pl-3 italic" } },
        link: {
          HTMLAttributes: { class: "text-crimson-ink underline underline-offset-4" },
          openOnClick: false,
        },
        underline: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Markdown.configure({ html: false, transformPastedText: true, breaks: true }),
    ],
    content: text,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        "aria-label": "Texte de l'élément",
        // Les mêmes règles que `BoardMarkdown` : le texte ne change pas
        // d'allure quand on se met à l'écrire.
        class: "flex min-h-full cursor-text select-text flex-col gap-[0.4em] leading-[1.45] focus:outline-none",
      },
      // Le champ vit dans le panneau : défiler jusqu'au curseur pousserait le
      // `scrollTop` de chaque ancêtre, canevas compris, que la vue ignore — et
      // la création comme le collage tomberaient ensuite à côté.
      handleScrollToSelection: () => true,
      handleKeyDown: (_view, event) => {
        if (event.key !== "Escape") return false;
        handlers.current.onEscape();
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      const markdown = current.storage.markdown.getMarkdown();
      written.current = markdown;
      handlers.current.onChange(markdown);
    },
    onBlur: () => handlers.current.onBlur(),
  });

  useEffect(() => {
    onEditor(id, editor);
    return () => onEditor(id, null);
  }, [id, editor, onEditor]);

  useEffect(() => {
    if (!editor || text === written.current) return;
    written.current = text;
    editor.commands.setContent(text, { emitUpdate: false });
  }, [editor, text]);

  return null;
}

/** Le texte dans l'élément. Tant qu'on n'y écrit pas, il laisse passer le
 *  pointeur : un clic saisit l'élément, un glissé le déplace. Une fois le
 *  curseur dedans, il garde le pointeur pour lui — on y place le curseur, on y
 *  sélectionne un mot — sans que le panneau ne le prenne pour un glissé. */
export function BoardTextContent({ editor, size }: { editor: Editor; size: number }) {
  const focused = useEditorState({ editor, selector: ({ editor: current }) => current.isFocused });

  // Le navigateur fait défiler la note jusqu'au curseur quand le texte dépasse
  // sa hauteur. Rendue ensuite en lecture dans le même cadre, elle garderait
  // ce défilement et s'afficherait amputée de ses premières lignes.
  useEffect(() => {
    if (focused) return;
    const body = (editor.view.dom as HTMLElement).closest("[data-element-body]");
    const rewind = () => body?.querySelectorAll<HTMLElement>("*").forEach((node) => {
      if (node.scrollTop || node.scrollLeft) node.scrollTo(0, 0);
    });
    rewind();
    return rewind;
  }, [editor, focused]);

  return (
    <EditorContent
      editor={editor}
      className={cn("size-full", focused && "pointer-events-auto")}
      style={{ fontSize: size, ["--taille-titre" as string]: `${headingSize(size)}px` }}
      onPointerDown={(event) => {
        if (focused) event.stopPropagation();
      }}
    />
  );
}

/** Place le curseur dans le texte au point cliqué, ou à la fin si le clic
 *  tombe hors du texte — sous la dernière ligne, dans la marge d'une note. */
export function focusTextAt(editor: Editor, clientX?: number, clientY?: number) {
  let position: number | null = null;
  if (clientX !== undefined && clientY !== undefined) {
    // Le texte laisse passer le pointeur tant qu'on n'y écrit pas, et la
    // recherche du point s'en remet au même test que le pointeur : elle ne le
    // trouverait pas.
    const dom = editor.view.dom as HTMLElement;
    dom.style.pointerEvents = "auto";
    position = editor.view.posAtCoords({ left: clientX, top: clientY })?.pos ?? null;
    dom.style.pointerEvents = "";
  }
  if (position === null) editor.commands.focus("end", { scrollIntoView: false });
  else editor.chain().focus(null, { scrollIntoView: false }).setTextSelection(position).run();
}

/** La barre de mise en forme, dans l'inspecteur. Elle agit sur le texte de
 *  l'élément, là où est son curseur. */
export function BoardTextToolbar({ id, editor }: { id: string; editor: Editor | null }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  const actifs = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      titre: current?.isActive("heading", { level: 3 }) ?? false,
      gras: current?.isActive("bold") ?? false,
      italique: current?.isActive("italic") ?? false,
      barre: current?.isActive("strike") ?? false,
      liste: current?.isActive("bulletList") ?? false,
      numerotee: current?.isActive("orderedList") ?? false,
      citation: current?.isActive("blockquote") ?? false,
      lien: current?.isActive("link") ?? false,
    }),
  });

  function poserLien() {
    if (!editor) return;
    const adresse = linkValue.trim();
    if (adresse) editor.chain().focus().extendMarkRange("link").setLink({ href: adresse }).run();
    else editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
    setLinkValue("");
  }

  return (
    <div className="flex flex-col gap-2">
      <p id={id} className="meta text-ink-muted">
        Texte
      </p>
      <div className="border border-rule bg-surface-inset">
        <div
          role="toolbar"
          aria-labelledby={id}
          className="flex flex-wrap gap-1 p-1"
        >
          <Outil editor={editor} label="Titre" active={actifs?.titre} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
            TITRE
          </Outil>
          <Outil editor={editor} label="Gras" active={actifs?.gras} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <span className="font-body text-[17px] font-semibold tracking-normal">G</span>
          </Outil>
          <Outil editor={editor} label="Italique" active={actifs?.italique} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <span className="font-body text-[17px] italic tracking-normal">I</span>
          </Outil>
          <Outil editor={editor} label="Barré" active={actifs?.barre} onClick={() => editor?.chain().focus().toggleStrike().run()}>
            <span className="font-body text-[17px] tracking-normal line-through">ab</span>
          </Outil>
          <Outil editor={editor} label="Liste à puces" active={actifs?.liste} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            LISTE
          </Outil>
          <Outil editor={editor} label="Liste numérotée" active={actifs?.numerotee} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            NUMÉROS
          </Outil>
          <Outil editor={editor} label="Citation" active={actifs?.citation} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
            CITATION
          </Outil>
          <Outil
            editor={editor}
            label="Lien"
            active={actifs?.lien || linkOpen}
            onClick={() => {
              setLinkValue(editor?.getAttributes("link").href ?? "");
              setLinkOpen((open) => !open);
            }}
          >
            LIEN
          </Outil>
        </div>

        {linkOpen ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-hairline p-2">
            <Input
              aria-label="Adresse du lien"
              value={linkValue}
              onChange={(event) => setLinkValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  poserLien();
                }
              }}
              placeholder="https://"
              className="w-auto min-w-0 flex-1"
            />
            <Button type="button" variant="outline" size="sm" onClick={poserLien}>
              {linkValue.trim() ? "POSER" : "RETIRER"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Outil({
  editor,
  label,
  active,
  onClick,
  children,
}: {
  editor: Editor | null;
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="quiet"
      size="sm"
      aria-label={label}
      title={label}
      aria-pressed={active ?? false}
      disabled={!editor}
      // Le bouton ne prend pas le focus : le texte le garde, et ce qu'on tape
      // juste après un clic arrive dans l'élément, pas sur le bouton.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn("px-3", active && "bg-surface-selected text-gold-ink")}
    >
      {children}
    </Button>
  );
}
