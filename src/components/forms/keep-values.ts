"use client";

import { useEffect, useRef } from "react";

/**
 * Empêcher React de vider un formulaire qu'on vient de soumettre.
 *
 * React 19 réinitialise le formulaire à chaque soumission par une action :
 * `startHostTransition` demande la remise à zéro avant même d'appeler
 * l'action, et le commit exécute `form.reset()`. Tout champ non contrôlé —
 * c'est-à-dire tout champ posé avec `defaultValue` — reprend alors la valeur
 * qu'il avait en arrivant.
 *
 * Quand l'action redirige, on ne le voit pas : la page change. Mais quand elle
 * **renvoie un état** — une erreur de validation sur un seul champ, un refus de
 * droit, une session expirée —, le formulaire reste à l'écran et tout ce qui
 * n'était pas contrôlé y est revenu à ce qui est en base. On corrige le champ
 * que le message désigne, on renvoie, et les autres modifications repartent à
 * l'envers : elles disparaissent sans que rien ne l'ait dit.
 *
 * L'événement `reset` est annulable, et ces formulaires redirigent tous quand
 * ils aboutissent : aucun n'a de raison de se vider tout seul.
 *
 * L'écouteur est posé **à la main sur le formulaire**, et non par la propriété
 * `onReset` : mesuré, React n'appelle pas son propre gestionnaire pour la
 * remise à zéro qu'il déclenche lui-même. Un écouteur natif, lui, la reçoit et
 * l'annule.
 *
 * Le formulaire de rumeur n'en est pas : il reste sur place après publication,
 * et son champ vidé est ce qu'on veut.
 */
export function useKeptFormValues() {
  const formulaire = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formulaire.current;
    if (!form) return;
    const garder = (event: Event) => event.preventDefault();
    form.addEventListener("reset", garder);
    return () => form.removeEventListener("reset", garder);
  }, []);

  return formulaire;
}
