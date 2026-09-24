/** Les listes ont un squelette, jamais un spinner centré. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 md:px-gutter-app xl:px-gutter-desktop">
      <span className="sr-only" role="status">
        Chargement en cours
      </span>
      <div aria-hidden="true" className="flex flex-col gap-8">
        <div className="h-10 w-[320px] max-w-full bg-surface-inset" />
        <div className="h-0.5 bg-rule" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex flex-col gap-3 border border-rule bg-surface p-6">
              <div className="h-5 w-24 bg-surface-inset" />
              <div className="h-6 w-3/4 bg-surface-inset" />
              <div className="h-4 w-full bg-surface-inset" />
              <div className="h-4 w-2/3 bg-surface-inset" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
