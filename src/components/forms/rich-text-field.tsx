"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRef, useState } from "react";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** L'éditeur des textes longs : on écrit ce qu'on verra, et le champ envoie du
 *  markdown.
 *
 *  Le markdown reste la forme enregistrée — c'est lui qui part dans la base et
 *  que `RichText` relit. L'éditeur n'est qu'une façon de le saisir : le champ
 *  caché porte déjà le texte au premier rendu, donc une soumission qui part
 *  avant que l'éditeur ait pris la main renvoie le texte d'origine plutôt que
 *  de l'effacer.
 *
 *  Les classes des blocs sont celles de `tokens.css`, posées sur les nœuds de
 *  l'éditeur comme `RichText` les pose à la lecture : ce qui est écrit ici a
 *  l'allure qu'il aura sur la fiche. */

/** `tiptap-markdown` range sa sérialisation dans le magasin de l'éditeur mais ne
 *  la déclare pas : sans cette ligne, `editor.storage.markdown` n'existe pas
 *  pour TypeScript. */
declare module "@tiptap/core" {
  interface Storage {
    markdown: MarkdownStorage;
  }
}

/** Comme à la lecture : une liste garde ses puces, donc pas de colonne flex. */
const BLOC_LISTE = "space-y-2 pl-5";

export function RichTextField({
  label,
  name,
  hint,
  error,
  defaultValue,
  rows = 10,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  defaultValue?: string | null;
  /** La hauteur de la zone, en lignes, comme pour un `Textarea`. */
  rows?: number;
}) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  const editor = useEditor({
    // Le rendu est repoussé au navigateur : ProseMirror n'a pas de DOM au rendu
    // serveur, et l'hydratation échouerait sur la différence.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [3], HTMLAttributes: { class: "card-title text-ink" } },
        bulletList: { HTMLAttributes: { class: cn(BLOC_LISTE, "list-disc") } },
        orderedList: { HTMLAttributes: { class: cn(BLOC_LISTE, "list-decimal") } },
        blockquote: {
          HTMLAttributes: {
            class: "flex flex-col gap-4 border-l-2 border-gold pl-4 quote text-ink-muted",
          },
        },
        horizontalRule: { HTMLAttributes: { class: "h-px border-0 bg-rule" } },
        link: {
          HTMLAttributes: { class: "text-crimson-ink underline underline-offset-4" },
          openOnClick: false,
        },
        // Le souligné n'existe pas en markdown : il repartirait en HTML, que la
        // lecture n'interprète pas. Le bloc de code non plus n'a rien à faire
        // dans une fiche de personnage.
        underline: false,
        codeBlock: false,
      }),
      // `breaks` fait d'un retour à la ligne simple un vrai retour à la ligne,
      // comme `remark-breaks` à la lecture. Sans lui, le retour disparaît
      // purement et simplement en entrant dans l'éditeur — « …couteau » et « et
      // tenir… » se retrouvaient collés — et les fiches écrites ligne à ligne
      // avant le markdown y perdraient leur mise en page.
      Markdown.configure({ html: false, transformPastedText: true, breaks: true }),
    ],
    content: defaultValue ?? "",
    editorProps: {
      attributes: {
        // L'étiquette visible ne peut pas pointer sur ce bloc : `EditorContent`
        // rend une division, pas un contrôle de formulaire. Elle est donc
        // redite ici, sur l'élément que le lecteur d'écran annonce.
        "aria-label": label,
        class: "flex flex-col gap-4 focus:outline-none",
        style: `min-height: ${rows * 1.65}em`,
      },
    },
    onUpdate: ({ editor: current }) => {
      // Le champ caché est mis à jour sans passer par l'état React : le
      // formulaire n'a pas à se rendre à nouveau à chaque frappe.
      if (hiddenRef.current) {
        hiddenRef.current.value = current.storage.markdown.getMarkdown();
      }
    },
  });

  // L'état des boutons suit le curseur : sans cet abonnement, « INTERTITRE »
  // resterait allumé après être sorti du titre — `useEditor` ne rend pas à
  // nouveau à chaque transaction.
  const actifs = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      gras: current?.isActive("bold") ?? false,
      italique: current?.isActive("italic") ?? false,
      intertitre: current?.isActive("heading", { level: 3 }) ?? false,
      liste: current?.isActive("bulletList") ?? false,
      numerotee: current?.isActive("orderedList") ?? false,
      citation: current?.isActive("blockquote") ?? false,
      lien: current?.isActive("link") ?? false,
    }),
  });

  function poserLien() {
    if (!editor) return;
    const adresse = linkValue.trim();
    if (adresse) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: adresse }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    setLinkOpen(false);
    setLinkValue("");
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <input type="hidden" name={name} ref={hiddenRef} defaultValue={defaultValue ?? ""} />

      <div className="border border-rule bg-surface-inset">
        <div
          role="toolbar"
          aria-label={`Mise en forme de « ${label} »`}
          className="flex flex-wrap items-center gap-1 border-b border-hairline p-1"
        >
          <ToolbarButton
            editor={editor}
            label="Gras"
            active={actifs?.gras}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            GRAS
          </ToolbarButton>
          <ToolbarButton
            editor={editor}
            label="Italique"
            active={actifs?.italique}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            ITALIQUE
          </ToolbarButton>
          <ToolbarButton
            editor={editor}
            label="Intertitre"
            active={actifs?.intertitre}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            INTERTITRE
          </ToolbarButton>
          <ToolbarButton
            editor={editor}
            label="Liste à puces"
            active={actifs?.liste}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            LISTE
          </ToolbarButton>
          <ToolbarButton
            editor={editor}
            label="Liste numérotée"
            active={actifs?.numerotee}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            NUMÉROTÉE
          </ToolbarButton>
          <ToolbarButton
            editor={editor}
            label="Citation"
            active={actifs?.citation}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            CITATION
          </ToolbarButton>
          <ToolbarButton
            editor={editor}
            label="Lien"
            active={actifs?.lien}
            onClick={() => {
              setLinkValue(editor?.getAttributes("link").href ?? "");
              setLinkOpen((open) => !open);
            }}
          >
            LIEN
          </ToolbarButton>
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
              className="w-auto flex-1"
            />
            <Button type="button" variant="outline" size="sm" onClick={poserLien}>
              {linkValue.trim() ? "POSER LE LIEN" : "RETIRER LE LIEN"}
            </Button>
          </div>
        ) : null}

        <EditorContent editor={editor} className="body px-[14px] py-3 text-ink-body" />
      </div>

      {hint ? <p className="caption text-ink-subtle">{hint}</p> : null}
      {error ? (
        <p role="alert" className="caption text-crimson-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ToolbarButton({
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
      aria-pressed={active ?? false}
      disabled={!editor}
      onClick={onClick}
      className={cn(active && "bg-surface-selected text-gold-ink")}
    >
      {children}
    </Button>
  );
}
