import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EventAccessChips } from "@/components/content/event-access-chips";
import { InvitationCodeForm } from "@/components/content/invitation-code-form";
import { RegistrationPanel } from "@/components/content/registration-panel";
import { PinIcon, RepeatIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { EventTypeChip } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";
import { GAME_TIME_ZONE, formatGameTime, formatLongDate } from "@/lib/dates";
import { canContribute } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { normaliserCodeDePartage } from "@/lib/share-code";
import { formatTyrianDate } from "@/lib/tyrian-calendar";
import { listCharactersOf } from "@/server/queries/characters";
import { getEventByShareCode } from "@/server/queries/events";

type Props = { params: Promise<{ code: string }> };

export const dynamic = "force-dynamic";

/** Une annonce privée ne se donne à aucun moteur : son adresse est le secret. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return buildMetadata({
    title: "Invitation",
    description: "Une scène partagée par son organisateur.",
    path: `/invitation/${code}`,
    noIndex: true,
  });
}

/** L'arrivée par un lien de partage.
 *
 *  Le code vaut l'accès : c'est tout ce que « qui a le lien peut consulter »
 *  veut dire. Lire ne demande pas de compte ; rejoindre, si — et l'inscription
 *  repasse le code à l'action, qui le revérifie. Rien n'est écrit à la simple
 *  visite : la liste des invités reste celle que l'organisateur a faite, et non
 *  celle des curieux qui ont ouvert le lien. */
export default async function InvitationPage({ params }: Props) {
  const { code } = await params;
  const normalise = normaliserCodeDePartage(code);
  if (!normalise) redirect(`/invitation?code=${encodeURIComponent(code)}`);
  // Une seule adresse par code : minuscules et tiret oublié reviennent à la forme écrite.
  if (normalise !== code) redirect(`/invitation/${normalise}`);

  const user = await getCurrentUser();
  const event = await getEventByShareCode(normalise, user);

  if (!event) return <LienPerime code={normalise} />;

  const characters = user ? await listCharactersOf(user.id) : [];
  const startsAt = new Date(event.startsAt);
  const endsAt = event.endsAt ? new Date(event.endsAt) : null;

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <div className="mx-auto max-w-[880px]">
        <PageHeader
          eyebrow="INVITATION"
          title={event.title}
          subtitle={
            <>
              {formatLongDate(startsAt)} · {formatTyrianDate(startsAt)} ·{" "}
              {formatGameTime(startsAt)}
              {endsAt ? ` → ${formatGameTime(endsAt)}` : ""}
              {event.organiser ? ` · organisé par ${event.organiser.name}` : ""}
            </>
          }
        />

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <EventTypeChip type={event.type} />
          <EventAccessChips event={event} />
        </div>

        {event.summary ? (
          <p className="mb-8 text-[19px] leading-[1.65] text-ink-body">{event.summary}</p>
        ) : null}

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <Card className="min-w-0 flex-1 gap-4 p-6">
            <p className="body-compact text-ink-body">
              Vous êtes arrivé par un lien de partage. Cette annonce n&apos;est pas à l&apos;agenda
              public : elle ne s&apos;y affichera pas, même après votre inscription.
            </p>
            <div className="h-px bg-hairline" />
            <p className="flex items-center gap-2 text-[16px] text-ink-muted">
              <PinIcon size={14} />
              {event.locationLabel}
            </p>
            {event.seriesDetail ? (
              <p className="flex items-center gap-2 text-[16px] text-ink-muted">
                <RepeatIcon size={14} />
                {event.seriesDetail.rule}
              </p>
            ) : null}
          </Card>

          <Card accent className="gap-4 p-6 lg:w-[340px] lg:shrink-0">
            <p className="panel-title">Rejoindre la scène</p>
            <dl className="flex flex-col">
              <Fact label="Date tyrienne" value={formatTyrianDate(startsAt)} />
              <Fact
                label="Heure"
                value={`${formatGameTime(startsAt)} (${GAME_TIME_ZONE})`}
              />
              <Fact
                label="Places prises"
                value={
                  event.capacity
                    ? `${event.registeredCount} / ${event.capacity}`
                    : String(event.registeredCount)
                }
              />
            </dl>
            <div className="border-t border-hairline pt-4">
              <RegistrationPanel
                event={event}
                characters={characters}
                isSignedIn={Boolean(user)}
                canRegister={canContribute(user)}
                shareCode={normalise}
                returnPath={`/invitation/${normalise}`}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Le code a été changé, ou l'annonce retirée. On le dit, et on rouvre la porte
 *  à un autre code plutôt que de renvoyer une page introuvable. */
function LienPerime({ code }: { code: string }) {
  return (
    <div className="mx-auto max-w-[760px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader eyebrow="INVITATION" title="Ce lien n'ouvre plus rien" />
      <p className="mb-8 text-[19px] leading-[1.65] text-ink-body">
        Le code <span className="font-display font-semibold tracking-[1px]">{code}</span> a été
        changé par l&apos;organisateur, ou l&apos;annonce a été retirée.
      </p>
      <InvitationCodeForm label="Essayer un autre code" />
      <p className="mt-8">
        <Link
          href="/evenements"
          className="text-[17px] text-crimson-ink underline-offset-4 hover:underline"
        >
          Voir l&apos;agenda public →
        </Link>
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-3 last:border-b-0">
      <dt className="text-[16px] text-ink-muted">{label}</dt>
      <dd className="text-right text-[17px] text-ink">{value}</dd>
    </div>
  );
}
