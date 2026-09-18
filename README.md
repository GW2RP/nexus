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
| `/meteo` | Météo des régions, produite par la simulation ; personne ne l'écrit |
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
| Conteur | En plus : rien pour l'instant — la météo, qui était son seul pouvoir propre, tourne désormais toute seule. |
| Administration | En plus : file des signalements, suppression, avertissement, suspension, et le dessin des zones de terrain. |

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

## La météo

Elle n'est pas écrite, elle est **simulée**. Quatre pas par jour — nuit, matin,
après-midi, soirée — sur une grille de **40 × 56 = 2 240 cellules** de 2 048 px.

La maille n'est pas choisie pour le continent mais pour la partie habitée : le
rectangle du continent est très majoritairement vide, et les six régions du hub
tiennent dans environ 22 000 × 21 000 px. À 4 096 px la Kryte entière faisait
trois cellules et un marais n'y pouvait rien changer ; à 2 048 px elle en fait
une douzaine.

### Ce que fait un pas

Toujours dans le même ordre (`src/lib/weather/engine.ts`, fonction pure, sans
base) : les centres de pression dérivent d'ouest en est, naissent et s'épuisent —
c'est **eux** qui font que le temps change seul ; le vent descend la pente de
pression ; l'advection porte l'humidité de la cellule au vent ; le terrain fait
son effet ; l'air rend ce qu'il ne peut plus tenir.

Le hasard sort d'une **graine rangée dans l'état**, jamais de `Math.random()`.
Deux conséquences : un pas est rejouable à l'identique, et la frise de `/meteo`
n'est pas une promesse — c'est le bulletin que la tâche planifiée écrira,
calculé en avance et jamais enregistré.

### Ce que fait chaque terrain

| Terrain | Effet |
| --- | --- |
| Mer | Nourrit l'humidité, à proportion de sa chaleur et du déficit de l'air ; lisse fortement la température |
| Marais | Retient l'humidité et sature plus bas que la plaine : c'est lui qui fabrique la brume |
| Relief | Refroidit selon l'altitude, force la pluie au vent et **assèche sous le vent** |
| Forêt | Retient un peu d'humidité, casse le vent |
| Terres arides | Assèchent et creusent l'écart du jour à la nuit |
| Rivière | Une mer étroite : un peu d'eau rendue à l'air, et la brume se lève pour un rien |
| Lac | La masse d'eau que la rivière n'a pas : il amortit presque tout l'écart du jour à la nuit |
| Volcan | Chauffe par en dessous en permanence (+6 °C) et assèche ; son froid d'altitude vient du champ `altitude` |
| Ville | La pierre rend la nuit ce qu'elle a pris le jour : +3 °C, peu de vent, plus sec |
| Plaine | La référence — et le terrain d'une cellule que personne n'a dessinée |

Mesuré à latitude constante, chaque terrain encadré de plaine, sur 240 pas :

| | Température | Écart jour/nuit | Humidité |
| --- | --- | --- | --- |
| Plaine (témoin) | 14,7 °C | 0,8 | 41 % |
| Ville | **+3,0** | **0,3** | 21 % |
| Lac | +0,1 | **0,1** | 75 % |
| Volcan | **+5,9** | 1,7 | 16 % |
| Rivière | +0,0 | 0,5 | 63 % |

Un témoin de plaine est posé de chaque côté de la bande : sans lui, la dérive
d'ouest en est se ferait passer pour un effet de terrain — c'est elle, et non la
rivière, qui explique l'essentiel de l'humidité en bout de course.

**L'ordre du tableau `TERRAINS` est gravé.** Le rang d'un terrain est l'entier
écrit dans les pas déjà stockés : un terrain nouveau s'ajoute **à la fin**,
jamais au milieu, sinon tout l'historique se relit de travers.

Les zones se dessinent au polygone depuis `/admin/terrains`. La liste montre la
**grille cuite** sous les tracés : une zone trop petite pour couvrir le centre
d'une cellule n'existe pas pour la simulation, et ça se voit au lieu de se
deviner. Quand deux zones se recouvrent, la dernière dessinée l'emporte.

**Cliquer la carte sonde un point** et affiche côte à côte la zone qui couvre ce
point et celle que la simulation retient pour sa cellule. Les deux se lisent du
même `zoneAt` (`src/lib/weather/grid.ts`) que la cuisson, donc le relevé ne peut
pas diverger de ce qui sera simulé. Quand elles diffèrent, l'écran le dit : la
zone est trop petite, ou tombe entre deux centres de cellule.

La `region` d'une zone est facultative, et c'est elle qui donne enfin une
**géographie** aux six régions, qui n'en avaient aucune. Une cellule sans région
n'entre dans aucun bulletin — elle n'est pas inventée. Un lieu ou un évènement
qui a des coordonnées prend le temps de **sa cellule** et garde l'étiquette de
sa région déclarée : deux lieux d'une même région peuvent donc afficher deux
temps différents.

### L'avancement

`vercel.json` déclenche `/api/meteo/avancer` quatre fois par jour, protégée par
`CRON_SECRET` (Vercel l'envoie en `Authorization: Bearer`). Sans secret
configuré, la route **refuse** : elle ne s'ouvre pas parce qu'une variable
manque.

Deux pièges de fuseau, tous deux traités :

- **Vercel évalue le cron en UTC**, sans fuseau, donc des horaires fixes dérivent
  d'une heure au passage à l'heure d'été. La route ne regarde jamais son heure de
  déclenchement : elle lit l'horloge d'`Europe/Paris` et rattrape les pas dus. Un
  appel trop tôt ne fait rien, un appel en retard rattrape. Les horaires retenus
  (23 h 05, 05 h 05, 11 h 05, 17 h 05 UTC) tombent dans la bonne tranche été
  comme hiver.
- **`toTyrianDate` calcule en UTC** : la tranche de nuit commence à 00 h 00 à
  Paris, soit 22 h ou 23 h UTC **la veille**. Lire la date d'un pas sur son
  instant la décalerait d'un jour une fois sur quatre. `civilDayOfStep`
  (`src/lib/weather/schedule.ts`) fait foi, pour la saison comme pour l'affichage.

Un pas pèse **44 Ko** : huit champs de 2 240 entiers 16 bits, empaquetés
(`src/lib/weather/pack.ts`), plus le terrain cuit au moment du pas. Un document
par cellule et par pas en aurait fait plus de trois millions par an. Trente jours
d'historique sont conservés, soit environ 5 Mo.

> Un piège coûteux, trouvé à la vérification : une lecture en `.lean()`
> court-circuite le cast de Mongoose et rend le `Binary` du pilote, dont
> `length` est une **méthode** et non un nombre. `Buffer.from` en tirait un
> tampon vide sans broncher, toute la grille se relisait en zéros — et zéro
> partout donne un ciel dégagé parfaitement crédible. `unpackInt16` **lève**
> désormais sur un tampon trop court : un défaut qui se déguise en beau temps
> ne se voit jamais.

La saison suit le **calendrier réel**, pas le tyrien : le lecteur voit les deux
dates côte à côte, et une tempête de neige un 21 juillet ne s'explique pas. Le
tyrien reste l'habillage, il ne commande pas le ciel.

## Scripts

```bash
npm run dev             # serveur de développement
npm run build           # construction de production
npm run start           # servir la construction
npm run lint            # ESLint
npm run typecheck       # TypeScript, sans émission
npm run db:seed         # jeu de données de départ (développement)
npm run db:role         # lire et poser le rôle d'un compte
npm run meteo:terrains  # zones de terrain de départ, d'après l'API du jeu
npm run meteo:simuler   # vérifie le moteur ; -- 360 pour une année, -- --base pour avancer
```

`meteo:simuler` tient lieu de suite de tests pour la simulation : géométrie,
horloge aux deux changements d'heure, bornes de chaque grandeur, présence des
six conditions sur une année, et **déterminisme** — deux passages doivent donner
le même résultat au chiffre près. Il sort en code 1 si une assertion tombe.

## Organisation du code

```
src/
  app/               routes App Router — (site) pour le hub, admin à part
  components/
    ui/              primitives shadcn restylées sur les jetons
    content/         cartes, lignes et panneaux du hub
    forms/           formulaires branchés sur les actions serveur
    map/             Leaflet, pins, calques de zones et éditeur de polygone
  lib/               jetons du domaine, dates tyriennes, SEO, session, droits
    weather/         la simulation : grille, moteur, horloge, empaquetage
  models/            schémas Mongoose
  server/
    queries/         lecture — renvoie des objets simples, jamais des documents
    actions/         écriture — actions serveur validées par Zod
    weather/         cuisson du terrain et avancement des pas
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
