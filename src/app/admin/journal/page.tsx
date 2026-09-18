import type { Metadata } from "next";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  MODERATION_ACTION_LABELS,
  REPORT_TARGET_LABELS,
  type ModerationAction,
} from "@/lib/domain";
import { formatLongDate } from "@/lib/dates";
import { buildMetadata } from "@/lib/seo";
import { listModerationLog } from "@/server/queries/reports";

export const metadata: Metadata = buildMetadata({
  title: "Journal de modération",
  description: "Le journal des décisions de modération du hub.",
  path: "/admin/journal",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function ModerationLogPage() {
  const entries = await listModerationLog(60);

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Journal de modération" />

      {entries.length > 0 ? (
        <ul className="flex flex-col">
          {entries.map((entry) => (
            <li key={entry.id} className="border-b border-hairline py-5 last:border-b-0">
              <p className="font-display text-[11px] font-medium uppercase tracking-[1.4px] text-gold-ink">
                {MODERATION_ACTION_LABELS[entry.action as ModerationAction]} ·{" "}
                {REPORT_TARGET_LABELS[entry.targetType]}
              </p>
              {entry.targetExcerpt ? (
                <p className="mt-2 text-[18px] italic leading-[1.55] text-ink-body">
                  {entry.targetExcerpt}
                </p>
              ) : null}
              <p className="mt-2 text-[18px] leading-[1.55] text-ink">{entry.reason}</p>
              <p className="mt-2 text-[15px] text-ink-muted">
                {entry.moderator?.name ?? "L'équipe"} · {formatLongDate(new Date(entry.createdAt))}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Le journal est vide"
        />
      )}
    </div>
  );
}
