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
| Images | Vercel Blob, téléversées depuis le navigateur |

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

Le rôle n'est pas choisi à l'inscription : il est posé par l'administration.
C'est aussi le seul chemin pour nommer la première :

```bash
npm run db:role                                   # liste les comptes et leur rôle
npm run db:role -- vous@exemple.fr administration
npm run db:role -- conteur@exemple.fr conteur
```

Toute action de modération est inscrite au journal avec son auteur, sa date et
son motif.

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

### Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `MONGODB_URI` | Chaîne de connexion Atlas. Le cluster doit être un jeu de réplicas — Better Auth y ouvre des transactions. |
| `MONGODB_DB` | Nom de la base dans le cluster (`gw2rp` par défaut). |
| `BETTER_AUTH_SECRET` | Secret de signature des sessions : `openssl rand -base64 32`. |
| `NEXT_PUBLIC_SITE_URL` | URL canonique sans barre oblique finale. En production : `https://www.gw2rp.eu`. |
| `BLOB_READ_WRITE_TOKEN` | Jeton du magasin Vercel Blob, pour le téléversement des images. Posé automatiquement quand un magasin est rattaché au projet. |
| `NEXT_PUBLIC_MAP_TILE_URL` | Facultatif — service de tuiles. Par défaut celui du jeu. |

## Déployer sur Vercel

1. Importez le dépôt, puis posez les quatre variables ci-dessus dans **Settings →
   Environment Variables** (`NEXT_PUBLIC_SITE_URL` vaut `https://www.gw2rp.eu`
   en production ; sans elle, l'URL du déploiement Vercel est utilisée).
2. Ajoutez `www.gw2rp.eu` comme domaine, et faites rediriger `gw2rp.eu` vers lui
   pour que la canonique reste unique.
3. Sur Atlas, autorisez les adresses sortantes de Vercel (ou `0.0.0.0/0` avec un
   utilisateur à droits limités) dans **Network Access**.
4. Créez un magasin **Blob** dans Storage et rattachez-le au projet : c'est lui
   qui reçoit les bannières, les portraits et les plans. `BLOB_READ_WRITE_TOKEN`
   est alors posé pour vous.

Rien d'autre à configurer : `next build` sort une application standard. Les
pages se lisant différemment selon la personne connectée — bouton de
modification, drapeau de signalement, état d'inscription — elles sont rendues à
chaque requête plutôt que mises en cache.

## Les images

Une image téléversée vit dans Vercel Blob, pas dans MongoDB. Supprimer la fiche
qui la portait ne l'emporte pas : `deleteUploadedImages` (`src/lib/blob.ts`) s'en
charge, à la suppression d'un contenu comme au remplacement d'une image.

Chaque image est rangée sous son auteur : `<dossier>/<id de l'auteur>/<fichier>`.
La route `/api/televersement` refuse de signer un jeton pour un autre chemin.

Trois règles y tiennent :

- Une adresse qui ne vient pas du magasin — saisie à la main, ou d'avant le
  téléversement — n'est jamais envoyée à la suppression.
- Une adresse rangée sous un autre membre non plus : recopier l'adresse d'autrui
  dans un champ image ne la fait pas effacer, elle part au journal du serveur.
- Un échec du stockage ne fait pas échouer la suppression du contenu : perdre
  une image est moins grave que laisser une fiche en place. L'échec part au
  journal du serveur.

« Masquer » et « suspendre », en modération, gardent les images : le contenu
peut être rétabli. Seule une suppression les emporte.

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
- Une adresse morte — fiche supprimée, slug inventé — sert la page « page
  introuvable » avec un statut **200** et non 404. C'est le comportement
  documenté de Next pour une réponse en flux, et `loading.tsx` en déclenche une
  sur toutes les pages du hub. Next y injecte `<meta name="robots"
  content="noindex">`, donc l'adresse n'est pas indexée. Un vrai 404
  demanderait de vérifier l'existence dans `proxy.ts`, avant que le corps parte.

## La carte

Les tuiles viennent du service officiel du jeu, lues en `CRS.Simple`. Les
coordonnées d'un lieu sont des **pixels de continent**, que l'auteur pose en
cliquant la carte plutôt qu'en les tapant.

Un piège à connaître : l'API annonce `max_zoom: 8` pour le continent, mais c'est
le **zoom 7** qui porte l'échelle de `continent_dims` — la grille servie au zoom
3 fait bien 20 × 28 tuiles, soit 81920/16/256 et 114688/16/256. Se tromper de
référence décale tout le monde de plusieurs milliers de pixels : les lieux
tombent en pleine mer. La constante est `COORDINATE_ZOOM` dans `src/lib/map.ts`.

## Scripts

```bash
npm run dev         # serveur de développement
npm run build       # construction de production
npm run start       # servir la construction
npm run lint        # ESLint
npm run typecheck   # TypeScript, sans émission
npm run db:seed     # jeu de données de départ (développement)
npm run db:role     # lire et poser le rôle d'un compte
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

- **Plans intérieurs** : le modèle porte l'image et ses points numérotés, mais
  aucun écran ne permet encore de les poser — ils se saisissent en base.
- **Suppression d'une rumeur** : l'action existe, mais aucun écran ne l'offre.
- **Courriels** : la vérification d'adresse et la réinitialisation de mot de
  passe attendent un service d'envoi. `requireEmailVerification` est à `false`
  tant qu'il n'y en a pas.
- **Rôle de modérateur** : un rôle intermédiaire, qui supprimerait un contenu
  sans pouvoir suspendre un compte, reste à trancher.
- **Attribution des tuiles** : le bloc en bas à droite de la carte affiche
  l'attribution d'ArenaNet ; son libellé exact reste à valider.
- **Cache** : tout est rendu à la requête. Un jour où le trafic le demandera,
  `cacheComponents` permettrait de garder une coquille statique et de ne
  streamer que les morceaux qui dépendent de la personne connectée.
