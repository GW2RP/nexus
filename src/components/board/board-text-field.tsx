"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useState } from "react";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";

declare module "@tiptap/core" {
  interface Storage {
    markdown: MarkdownStorage;
  }
}

/** Le texte d'une note ou d'un bloc de texte, écrit comme il se lira.
 *
 *  C'est l'éditeur des fiches (`RichTextField`), réduit à ce qu'un panneau
 *  porte : titre, gras, italique, barré, lien, listes et citation. Pas d'image —
 *  une note se lit d'un coup d'œil — et pas de souligné, qui n'existe pas en
 *  markdown. Le texte part en markdown, comme partout ailleurs.
 *
 *  Le champ se remonte quand on change d'élément (`key` chez l'appelant) : il
 *  prend son contenu à la création, il ne le suit pas ensuite. */
export function BoardTextField({
  id,
  value,
  autoFocus = false,
  onChange,
  onBlur,
}: {
  id: string;
  value: string;
  /** Un élément qu'on vient de poser : on écrit dedans sans le chercher. */
  autoFocus?: boolean;
  onChange: (markdown: string) => void;
  onBlur: () => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [3], HTMLAttributes: { class: "font-display font-semibold text-ink" } },
        bulletList: { HTMLAttributes: { class: "list-disc pl-5" } },
        orderedList: { HTMLAttributes: { class: "list-decimal pl-5" } },
        blockquote: { HTMLAttributes: { class: "border-l-2 border-gold pl-3 italic" } },
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
    content: value,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        id,
        "aria-label": "Texte de l'élément",
        class: "flex min-h-[8em] flex-col gap-2 focus:outline-none",
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.storage.markdown.getMarkdown()),
    onBlur: () => onBlur(),
  });

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
      <Label htmlFor={id}>Texte</Label>
      <div className="border border-rule bg-surface-inset">
        <div
          role="toolbar"
          aria-label="Mise en forme du texte"
          className="flex flex-wrap gap-1 border-b border-hairline p-1"
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
          <div className="flex flex-wrap items-center gap-2 border-b border-hairline p-2">
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

        <EditorContent editor={editor} className="body-compact px-3 py-2 text-ink-body" />
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
      // juste après un clic arrive dans la note, pas sur le bouton.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn("px-3", active && "bg-surface-selected text-gold-ink")}
    >
      {children}
    </Button>
  );
}
