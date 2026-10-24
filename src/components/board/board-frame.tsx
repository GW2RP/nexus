import { Breadcrumb } from "@/components/ui/breadcrumb";

/** Le cadre d'un écran de panneau : l'en-tête — fil d'Ariane, titre, puces et
 *  actions —, puis le corps, qui prend la hauteur restante comme la carte.
 *  L'éditeur et l'exploration en VR le partagent, pour qu'un changement de
 *  l'en-tête ne se fasse qu'à un endroit. */
export function BoardFrame({
  crumbs,
  title,
  badges,
  actions,
  children,
}: {
  crumbs: { label: string; href?: string }[];
  title: string;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:h-[calc(100dvh-82px)] lg:min-h-[640px]">
      <header className="border-b-2 border-rule bg-surface px-gutter-mobile pt-4 lg:px-gutter-app">
        <Breadcrumb items={crumbs} />
        <div className="-mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-3">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="font-display text-[22px] font-semibold leading-[1.2] sm:text-[27px]">{title}</h1>
            {badges}
          </div>
          <div className="flex flex-wrap items-end gap-4">{actions}</div>
        </div>
      </header>

      <div className="lg:min-h-0 lg:flex-1">{children}</div>
    </div>
  );
}
