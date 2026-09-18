@AGENTS.md

# GW2RP Nexus

Hub de jeu de rôle Guild Wars 2, en français. Next.js 16 (App Router) + Tailwind
v4 + shadcn/ui + MongoDB (Mongoose) + Better Auth. Déployé sur Vercel, base sur
Atlas, domaine `www.gw2rp.eu`.

## Ce qui ne se discute pas

- **Les jetons font foi.** Aucune couleur, taille de texte ou espacement ne
  s'écrit en dur : tout passe par `src/app/tokens.css`, exposé à Tailwind dans
  `globals.css`. `tokens.css` est une sortie du design system — on ne l'édite
  pas à la main.
- **Le trait plutôt que l'ombre.** Angles vifs partout (`--radius: 0`), aucune
  ombre portée, aucun dégradé décoratif. Seuls les portraits, pins et pastilles
  numérotées sont ronds.
- **Une action principale par écran.** Un seul bouton `crimson` par page.
- **Les capitales s'écrivent dans le contenu**, jamais avec `text-transform` :
  le lecteur d'écran doit lire ce qui est écrit.
- **Rien d'inventé.** Une donnée absente affiche un placeholder explicite avec
  sa dimension attendue, jamais un faux contenu ni un faux chiffre.
- **Les dates** : la date réelle en premier, la date tyrienne en second. Les
  heures sont celles du serveur de jeu (`Europe/Paris`) et sont affichées comme
  telles.
- **L'interface est en français**, contenu, libellés, messages d'erreur et
  commentaires de code compris.

## Frontières

- `src/server/**` ne s'importe jamais depuis un composant client. L'état de
  formulaire partagé vit dans `src/lib/action-state.ts`.
- Les requêtes (`src/server/queries`) renvoient des objets simples sérialisés,
  jamais des documents Mongoose.
- Les écritures passent par des actions serveur validées par Zod
  (`src/server/actions`), qui vérifient le rôle avant d'écrire.

## Avant de pousser

```bash
npm run typecheck && npm run lint && npm run build
```
