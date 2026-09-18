# GW2RP Nexus

Le hub communautaire francophone de jeu de rôle dans l'univers de Guild Wars 2 :
registre des personnages, carte vivante, agenda des évènements avec inscriptions,
tableau des rumeurs, signalement et modération.

Production : **https://www.gw2rp.eu** — hébergé sur Vercel, base MongoDB Atlas.

Le hub n'est affilié ni à ArenaNet, LLC ni à NCSOFT.

## La pile

| | |
| --- | --- |
| Cadre | Next.js 16 (App Router, React 19, Turbopack) |
| Styles | Tailwind CSS v4 + primitives shadcn/ui restylées sur les jetons |
| Base | MongoDB Atlas — Mongoose pour le métier, driver natif pour l'authentification |
| Authentification | Better Auth, courriel + mot de passe |
| Carte | Leaflet en `CRS.Simple` sur les tuiles officielles du jeu |

## Le design system

L'interface suit **Tyrie RP** : parchemin ivoire, encre brune, filets dorés,
capitales romaines, angles vifs, aucune ombre. Un thème sombre inverse les mêmes
valeurs, porté par `data-theme` sur `<html>`.

- `src/app/tokens.css` est la **sortie** du design system : couleurs des deux
  thèmes, échelle d'espacement, traits, familles et styles de texte. Il ne
  s'édite pas à la main — on le régénère depuis le design system.
- `src/app/globals.css` l'importe dans la couche `base`, expose les jetons à
  Tailwind dans un bloc `@theme inline`, puis mappe les variables de shadcn
  dessus. `--radius` vaut `0`.
- En cas d'écart entre une maquette et le design system, **c'est le système qui
  fait foi**.

## Les routes

| Route | Écran |
| --- | --- |
| `/` | Accueil |
| `/carte` | Carte plein écran ; `?lieu=` ouvre le panneau de détail |
| `/personnages` · `/personnages/[slug]` | Registre et fiche |
| `/lieux` · `/lieux/[slug]` | Registre et fiche, avec plan intérieur |
| `/evenements` | `?vue=agenda` (défaut) ou `?vue=calendrier` |
| `/evenements/[slug]` | Fiche et inscription |
| `/rumeurs` | Tableau des rumeurs |
| `/meteo` | Météo des régions ; l'écriture est réservée aux conteurs |
| `/mon-compte` | Personnages, inscriptions et annonces du compte |
| `/admin/signalements` · `/admin/signalements/[id]` | File et examen |
| `/admin/journal` | Journal de modération |

Agenda et calendrier sont deux vues d'une même route : la bascule conserve les
filtres, qui vivent dans l'URL. C'est ce qui permet de partager un lien de liste
filtrée.

## Les rôles

| Rôle | Peut |
| --- | --- |
| Visiteur | Lire tout le contenu public. Ne signale pas, ne s'inscrit pas. |
| Membre | Créer et modifier ses personnages, lieux, évènements et rumeurs ; s'inscrire ; signaler. |
| Conteur | En plus : poser la météo d'une région. |
| Administration | En plus : file des signalements, suppression, avertissement, suspension. |

Le rôle n'est pas choisi à l'inscription : il est posé par l'administration
(champ `role` de la collection `user`). Toute action de modération est inscrite
au journal avec son auteur, sa date et son motif.

## Démarrer

```bash
npm install
cp .env.example .env.local   # puis remplir les valeurs
npm run dev
```

Créez un compte sur `/inscription`, puis posez un jeu de départ :

```bash
npm run db:seed
```

Le jeu de départ vide les collections de contenu et les remplit avec quelques
personnages, lieux, évènements et rumeurs. Il attribue tout au premier compte
créé. Il n'a rien à faire en production.

Pour vous donner le rôle d'administration sur votre propre compte :

```js
// mongosh
db.user.updateOne({ email: "vous@exemple.fr" }, { $set: { role: "administration" } })
```

### Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `MONGODB_URI` | Chaîne de connexion Atlas. Le cluster doit être un jeu de réplicas — Better Auth y ouvre des transactions. |
| `MONGODB_DB` | Nom de la base dans le cluster (`gw2rp` par défaut). |
| `BETTER_AUTH_SECRET` | Secret de signature des sessions : `openssl rand -base64 32`. |
| `NEXT_PUBLIC_SITE_URL` | URL canonique sans barre oblique finale. En production : `https://www.gw2rp.eu`. |
| `NEXT_PUBLIC_MAP_TILE_URL` | Facultatif — service de tuiles. Par défaut celui du jeu. |

## Déployer sur Vercel

1. Importez le dépôt, puis posez les quatre variables ci-dessus dans **Settings →
   Environment Variables** (`NEXT_PUBLIC_SITE_URL` vaut `https://www.gw2rp.eu`
   en production ; sans elle, l'URL du déploiement Vercel est utilisée).
2. Ajoutez `www.gw2rp.eu` comme domaine, et faites rediriger `gw2rp.eu` vers lui
   pour que la canonique reste unique.
3. Sur Atlas, autorisez les adresses sortantes de Vercel (ou `0.0.0.0/0` avec un
   utilisateur à droits limités) dans **Network Access**.

Rien d'autre à configurer : `next build` sort une application standard, les
pages de contenu se revalident toutes les cinq minutes et l'administration est
rendue à la demande.

## Le référencement

Chaque page expose son titre, sa description, sa canonique, ses balises Open
Graph et sa carte Twitter, montées par `buildMetadata` (`src/lib/seo.ts`).

- Les fiches de personnage, de lieu et d'évènement portent leurs données
  structurées (`Person`, `Place`, `Event`) et un fil d'Ariane `BreadcrumbList`.
- `/sitemap.xml` liste les pages fixes et toutes les fiches publiées ;
  `/robots.txt` écarte l'API, l'administration, les formulaires et le compte.
- Les pages de création, d'édition, de connexion et d'administration sont en
  `noindex`.
- La carte de partage par défaut est générée par `src/app/opengraph-image.tsx`.

## Scripts

```bash
npm run dev         # serveur de développement
npm run build       # construction de production
npm run start       # servir la construction
npm run lint        # ESLint
npm run typecheck   # TypeScript, sans émission
npm run db:seed     # jeu de données de départ (développement)
```

## Organisation du code

```
src/
  app/               routes App Router — (site) pour le hub, admin à part
  components/
    ui/              primitives shadcn restylées sur les jetons
    content/         cartes, lignes et panneaux du hub
    forms/           formulaires branchés sur les actions serveur
    map/             Leaflet, pins et panneau de carte
  lib/               jetons du domaine, dates tyriennes, SEO, session, droits
  models/            schémas Mongoose
  server/
    queries/         lecture — renvoie des objets simples, jamais des documents
    actions/         écriture — actions serveur validées par Zod
```

Les composants client n'importent jamais `src/server/**` : l'état de formulaire
partagé vit dans `src/lib/action-state.ts`.

## Points laissés ouverts

- **Téléversement d'images** : les bannières, portraits et plans se saisissent
  aujourd'hui par leur adresse. Un stockage (Vercel Blob ou S3) reste à brancher,
  avec ses limites de format, de poids et de dimensions.
- **Courriels** : la vérification d'adresse et la réinitialisation de mot de
  passe attendent un service d'envoi. `requireEmailVerification` est à `false`
  tant qu'il n'y en a pas.
- **Rôle de modérateur** : un rôle intermédiaire, qui supprimerait un contenu
  sans pouvoir suspendre un compte, reste à trancher.
- **Attribution des tuiles** : le bloc en bas à droite de la carte affiche
  l'attribution d'ArenaNet ; son libellé exact reste à valider.
