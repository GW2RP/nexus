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

Un évènement se tient dans un lieu, donc son pin tombe **exactement** sur celui
du lieu : le pin du dessous n'était ni visible ni cliquable, et la carte
annonçait dix pins pour six. Les pins qui partagent un point s'étalent
maintenant en une rangée **centrée sur ce point** — le lieu désigné reste le
vrai, et chaque pin garde un centre à soi où cliquer.

## La météo

Elle n'est pas écrite, elle est **simulée**. Un pas **toutes les deux heures**,
soit douze par jour, sur une grille de **160 × 224 = 35 840 cellules** de 512 px.

La tranche — nuit, matin, après-midi, soirée — se lit désormais sur l'**heure**
du pas et non sur son rang : à six heures de pas une tranche valait un pas, à
deux heures elle en compte trois. Les écrans affichent donc l'heure à côté du
nom de la tranche, sinon trois lignes de suite diraient « MATIN » sans qu'on
sache laquelle est laquelle.

La maille n'est pas choisie pour le continent mais pour la partie habitée : le
rectangle du continent est très majoritairement vide, et les six régions du hub
tiennent dans environ 22 000 × 21 000 px. À 4 096 px la Kryte entière faisait
trois cellules et un marais n'y pouvait rien changer ; à 512 px elle en fait deux
cents, et un relief s'y dessine au détail.

**La finesse ne change pas le climat.** Les grandeurs spatiales du moteur sont
écrites pour une maille de référence et converties, comme les taux le sont pour
la cadence — sans quoi diviser la maille rétrécirait les dépressions de moitié et
ralentirait les fronts d'autant.

La vérification demande un détour, parce qu'une seule partie ne prouve rien : le
hasard du moteur se consomme cellule par cellule, donc deux mailles ne jouent
jamais la même météo, et d'une graine à l'autre la pluie passe de 1,4 à 14 % des
cellules. On rejoue donc **les mêmes graines** aux deux mailles, 540 pas chacune.
Au passage de 1 024 à 512 px, ce qui ne bouge pas ne bouge sur aucune des trois :

| | 1 024 px | 512 px |
| --- | --- | --- |
| Température moyenne | 11,3 °C | 11,2 °C |
| Orage | 1,76 % | 1,86 % |
| Vent fort | 0,62 / 5,48 / 0,65 % | 0,59 / 5,53 / 0,65 % |
| Brume | 8,9 / 14,6 / 17,2 % | 7,7 / 15,0 / 17,5 % |

Ce que la finesse change, c'est la **concentration** — et là aussi sur les trois
graines : la surface qui précipite tombe de moitié (5,5 → 2,9 %, 5,4 → 2,8 %)
tandis que la pointe de précipitation monte de 58 à 100, le plafond de l'échelle.
Même eau, moins étalée : une averse plus nette sur un territoire plus petit. La
neige et la pluie fine étant comptées **par cellule**, elles suivent cette
surface et tombent de moitié avec elle. C'est le comportement propre à la
résolution, déjà relevé de 2 048 à 1 024 px, et non un décalage de calibrage.

La grille pèse en retour quatre fois plus : **701 Ko par pas** au lieu de 176. La
conservation passe donc de trente jours à **sept** — 58 Mo au lieu de 246 — parce
que rien ne relit un pas ancien : l'avancement reprend le dernier écrit, la
prévision se rejoue en avant depuis lui, et le rattrapage est plafonné à trois
jours. Le reste était une archive, et une archive n'a pas à quadrupler.

Le coût de calcul, mesuré : **37 ms par pas** contre 8, et le pire cas du cron —
trois jours d'absence, 36 pas — passe de 0,6 à **2,1 s**, pour une route
plafonnée à 60.

### Ce que fait un pas

Toujours dans le même ordre (`src/lib/weather/engine.ts`, fonction pure, sans
base) : les centres de pression dérivent d'ouest en est, naissent et s'épuisent —
c'est **eux** qui font que le temps change seul ; le vent descend la pente de
pression ; l'advection porte l'humidité de la cellule au vent ; le terrain fait
son effet ; l'air rend ce qu'il ne peut plus tenir.

Les taux du moteur sont écrits **pour six heures** et ramenés à la cadence
courante à la lecture (`parPas`, `fractionParPas`, `decroissanceParPas`). Ce
n'est pas une division : une grandeur qui se relaxe vers une source a un point
fixe, et diviser naïvement la source l'abaissait de 20 % — les orages avaient
disparu au passage à deux heures. `relaxe` conserve ce point fixe, de sorte que
la cadence change la finesse du temps, pas le climat.

Les seuils de lecture sont rassemblés dans `SEUILS` : aucun nombre nu au milieu
d'une condition, et une recalibration se lit d'un coup d'œil. Ils sont relevés
sur les **cellules en région**, pas sur le rectangle du continent — voir plus
bas, c'est cette confusion de population qui a produit trois phénomènes morts.

Le vent se calcule en unités de gradient et s'affiche en km/h : `VENT_ECHELLE`
fait le pont. Elle vaut 3, posée après avoir constaté que l'écran annonçait des
km/h que la grandeur ne portait pas — médiane 6, maximum 30, un « vent fort »
inatteignable. Elle divise à chacun de ses usages physiques, donc la simulation
est inchangée : la distribution du ciel est identique au centième.

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

Mesuré à latitude constante, chaque terrain encadré de plaine, sur 240 jours.
Les écarts sont pris contre les **plaines voisines**, pas contre une moyenne :

| | Température | Écart jour/nuit | Humidité |
| --- | --- | --- | --- |
| Plaine (témoin) | 11,7 °C | 0,6 | 28 → 34 % |
| Ville | **+3,0** | **0,2** | −9 |
| Lac | +0,0 | **0,0** | +25 |
| Volcan | **+6,0** | 1,8 | −8 |
| Rivière | +0,0 | 0,3 | +21 |
| Marais | +0,0 | 0,2 | **+34** |
| Forêt | +0,0 | 0,3 | +19 |
| Terres arides | +0,0 | **2,0** | **−24** |

Un témoin de plaine est posé de chaque côté de la bande, et c'est lui qui rend la
mesure lisible : la plaine passe de 28 à 34 % d'humidité d'un bout à l'autre par
la seule dérive d'ouest en est. Sans ces témoins, cette dérive se ferait passer
pour un effet de terrain — c'est elle, et non la rivière, qui expliquait
l'essentiel de l'humidité en bout de course.

**L'ordre du tableau `TERRAINS` est gravé.** Le rang d'un terrain est l'entier
écrit dans les pas déjà stockés : un terrain nouveau s'ajoute **à la fin**,
jamais au milieu, sinon tout l'historique se relit de travers.

Les zones se dessinent au polygone depuis `/admin/terrains`. La liste montre la
**grille cuite** sous les tracés : une zone trop petite pour couvrir le centre
d'une cellule n'existe pas pour la simulation, et ça se voit au lieu de se
deviner. La grille voyage jusqu'à l'écran en **un caractère par cellule** — le
rang du terrain dans `TERRAINS`, celui-là même qu'on écrit dans les pas. En liste
de `{ index, terrain }` elle pesait 1 093 Ko à cette maille ; en rangs, 35 Ko, et
un clic de sonde répond en 141 ms au lieu de 744.

**L'ordre d'application se modifie.** Quand deux zones se recouvrent, la dernière
de la liste l'emporte — et cette liste n'est plus celle de l'ordre de création :
chaque ligne porte son rang et deux boutons qui la font monter ou descendre d'un
cran. C'est le même ordre partout : la cuisson (`bakeFromZones`), la liste, et le
calque de la carte, qui peint donc la gagnante par-dessus. Un seul tri, écrit une
fois (`ORDRE_DAPPLICATION`), sinon l'écran et la simulation raconteraient deux
ordres différents.

Un déplacement ne pousse pas un compteur : il relit la liste, y échange deux
voisines et **renumérote tout** de zéro. C'est ce qui rend la bascule sûre — les
zones d'avant le rang n'en portent aucun, et le premier déplacement les numérote
toutes dans l'ordre où elles se cuisaient déjà. Le champ est d'ailleurs
facultatif et **sans valeur par défaut** : à zéro par défaut, le simple
enregistrement du formulaire aurait fait gagner une zone sur ses voisines sans
rang, un changement de simulation que personne n'aurait demandé.

Ce que l'ordre change se voit d'un relevé : l'océan couvre tout le continent et
se cuit en premier, donc tout le reste se pose dessus. Passé en dernier, il
reprend les 35 840 cellules, et la sonde qui annonçait « Kryte — Plaine » annonce
« L'océan — Mer ». Une zone nouvelle se pose **au-dessus** des autres : on dessine
presque toujours un détail sur un fond déjà là.

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

`vercel.json` déclenche `/api/meteo/avancer` **toutes les heures** à 05,
protégée par `CRON_SECRET` (Vercel l'envoie en `Authorization: Bearer`). Sans secret
configuré, la route **refuse** : elle ne s'ouvre pas parce qu'une variable
manque.

Deux pièges de fuseau, tous deux traités :

- **Vercel évalue le cron en UTC**, sans fuseau, donc des horaires fixes dérivent
  d'une heure au passage à l'heure d'été. La route ne regarde jamais son heure de
  déclenchement : elle lit l'horloge d'`Europe/Paris` et rattrape les pas dus. Un
  appel trop tôt ne fait rien, un appel en retard rattrape. Le battement horaire
  retire le problème à la racine : quelle que soit la saison, l'appel qui suit
  une bascule de pas le produit dans l'heure.
- **`toTyrianDate` calcule en UTC** : la tranche de nuit commence à 00 h 00 à
  Paris, soit 22 h ou 23 h UTC **la veille**. Lire la date d'un pas sur son
  instant la décalerait d'un jour une fois sur quatre. `civilDayOfStep`
  (`src/lib/weather/schedule.ts`) fait foi, pour la saison comme pour l'affichage.

Un pas porte la **cadence** qui l'a produit (`stepsPerDay`). Changer la cadence
renumérote tout : le pas 215 de la nouvelle grille n'a rien à voir avec le 215 de
l'ancienne, et reprendre le fil mélangerait deux mondes. L'avancement écarte donc
un dernier pas d'une autre cadence, repart du pas courant, et retire les périmés
en le disant dans le journal.

L'appel qui n'a **rien à produire** — un sur deux, à battement horaire pour des
pas de deux heures — rend la main sur une seule lecture : il ne cuit pas le
terrain et n'écrit pas une ligne. Le ménage et la cuisson attendent le chemin qui
écrit déjà.

Un pas pèse **701 Ko** : dix champs de 35 840 entiers 16 bits, empaquetés
(`src/lib/weather/pack.ts`), terrain cuit compris. En tableaux BSON les mêmes
champs pèseraient 3,65 Mo, et chaque page du hub les relirait en entier : à cette
maille l'empaquetage n'est plus une économie, c'est une condition. Un document
par cellule et par pas en aurait fait cent cinquante-sept millions par an. Sept
jours d'historique sont conservés, soit 58 Mo à douze pas par jour.

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

### Les calques de la carte

`/carte` porte deux calques **indépendants**, chacun avec son interrupteur :
**Météo**, allumé, et **Terrains**, éteint. Les zones de terrain sont un outil de
cartographe ; les phénomènes, un décor de joueur. Les deux peuvent se regarder
ensemble quand on veut vérifier qu'un marais tient bien sa brume.

Une cellule n'est teintée que si elle porte un phénomène
(`src/lib/weather/phenomena.ts`) :

| Phénomène | Ce qui le déclenche | Part des cellules |
| --- | --- | --- |
| Orage | Condition `orage` | 0,41 % |
| Neige | Condition `neige` | 5,95 % |
| Pluie | Condition `pluie-fine` | 16,25 % |
| Brume | Condition `brume` | 19,70 % |
| Vent fort | Vent ≥ 40 km/h, **quelle que soit la condition** | 0,68 % |
| Forte chaleur | Température ≥ 28 °C, **quelle que soit la condition** | 3,01 % |

Mesuré sur une année tyrienne, sur les **cellules en région** — celles que la
carte teinte. `npm run meteo:simuler` réimprime ce tableau à chaque passage.

Les deux derniers ne sont pas des conditions : une cellule peut être dégagée et
en forte chaleur, ou en orage et dans un vent fort. C'est précisément ce que
`WEATHER_CONDITIONS`, qui ne rend qu'une valeur, ne sait pas dire. Quand une
cellule en porte plusieurs, **l'ordre de `PHENOMENES` tranche** — le plus
remarquable d'abord — et l'opacité suit la précipitation, donc une averse se voit
plus qu'une bruine.

La légende ne liste que les phénomènes **effectivement présents** au pas courant :
rien d'inventé, et aucune entrée morte un jour de beau temps.

**La carte ne montre pas la maille.** Les cellules d'un même phénomène sont
recousues en **une seule zone** (`src/lib/weather/contours.ts`), qui porte son
symbole au milieu. Une grille annonce sa résolution ; un contour dit où il pleut,
et c'est la seule chose à savoir. Le tracé se fait au bord : on garde les côtés
de cellule qui séparent la tache de l'extérieur, on jette ceux qui séparent deux
cellules de la même tache, et on recoud le reste en anneaux fermés. Une tache
peut être percée, donc elle rend plusieurs anneaux — le premier la cerne, les
suivants la percent — et le symbole tombe toujours sur une cellule de la tache,
jamais dans un trou.

L'invariant qui le prouve : sur une tache tirée au hasard, l'aire du contour
moins celle des trous vaut **exactement** le nombre de cellules. Relevé à
l'écran, les 35 840 cellules de la grille se ramènent à une dizaine de zones —
3,8 Ko de JSON pour la page, là où la grille entière n'y tiendrait pas.

**La sonde.** L'interrupteur `SONDER` relève le temps au point cliqué : sa
condition, ses phénomènes, sa région, son terrain et ses six grandeurs. La grille
entière ne peut pas voyager jusqu'au navigateur — 35 840 cellules et dix
grandeurs — alors qu'un relevé tient en quelques nombres, d'où la route de
lecture `/api/meteo/point`, publique comme la météo elle-même. La sonde se met en
marche pour ne pas voler le clic qui choisit un lieu, et s'éteindre retire le
relevé avec sa croix : un repère que plus rien ne nomme n'apprend rien.

**Sur un téléphone, rien ne se pose sur la carte** sauf les deux interrupteurs.
La légende et les bulletins de région descendent dans une bande sous la carte —
une ligne qui se replie pour l'une, une bande qui se fait défiler pour les
autres. Mesuré à 390 px : les deux panneaux en surimpression masquaient **66 %**
de la carte, qui elle-même ne commençait qu'à mille pixels du haut de page,
poussée par la liste des lieux. La carte occupe maintenant la moitié haute de
l'écran, masquée à 5 %.

### La bande habitée

Le calque a fait remonter un défaut que rien d'autre n'aurait montré : **trois
des six phénomènes ne se déclenchaient jamais** sur les terres du hub — orage
0,01 %, forte chaleur 0,00 %, vent fort 0,20 %.

Les six régions tiennent entre les ordonnées **22 528 et 47 104 px**, un
cinquième de la hauteur du continent ; le reste est de l'océan vide. La bande est
écrite en pixels et non en lignes de grille, sinon changer la maille la
déplacerait. Or le gradient nord-sud était étalé sur tout le
rectangle du continent : des Pics Glacés à Orr il ne restait que **4 °C** d'écart,
le maximum annuel sur les terres était de 19 °C, et une région désertique était
aussi froide que les sommets. Le gradient s'étale désormais sur cette bande et se
borne au-delà (`BANDE_NORD` / `BANDE_SUD` dans `engine.ts`) — le même
raisonnement que la maille de la grille : on calibre sur la partie habitée.

Après quoi : juillet 17,9 °C de moyenne sur les terres, janvier 2,2 °C, maximum
annuel 32 °C. La forte chaleur passe de 0,00 à 3,01 %.

Les deux autres tenaient de la même confusion de population :

- **L'orage** demandait la coïncidence de trois grandeurs : pluie forte,
  dépression, chaleur. La pression n'y était pour rien — quand il pleut fort sur
  les terres, sa médiane vaut 1013, la référence même, et retirer la clause ne
  change pas un chiffre au large. Ce qui bloquait était ailleurs : la saturation
  monte avec la température, donc une pluie forte sur les terres est un évènement
  **froid**, et 86 % des averses fortes tombaient sous 8 °C. La règle dit
  maintenant ce qu'un orage est — il pleut dru et il fait chaud.
- **Le vent fort** était posé à 50 km/h, le centile 98 du vent du **continent** —
  mais le centile 99,8 de celui des terres. À 40 km/h, c'est leur centile 99,3.

Aucun de ces trois défauts n'était visible tant que la météo ne se lisait que
région par région : il a fallu dessiner les cellules une à une pour que les
zéros se voient.

## L'application bureau

Le dépôt `overlay` porte l'application bureau (Tauri + React) qui pose la
météo et les lieux à proximité par-dessus le jeu, à l'emplacement du
personnage joué. Le hub lui expose deux choses, et rien d'autre :

- **Une session par jeton.** L'application n'a pas le cookie du hub — sa vue
  web n'est pas sur le même domaine, et ses requêtes partent de Rust. Better
  Auth porte donc le greffon `bearer` : à la connexion par courriel et mot de
  passe, le jeton de session est rendu dans l'en-tête `set-auth-token`, et
  l'application le représente en `Authorization: Bearer`. Le navigateur, lui,
  ne voit rien changer : sans cet en-tête, la session reste le cookie.
- **`GET /api/lieux/proximite?x=&y=&rayon=&limite=`** — les lieux du registre
  autour d'un point de la carte, du plus proche au plus éloigné, chacun avec sa
  distance en pixels de continent. Publique, comme `/api/meteo/point` : le
  registre l'est déjà, et la route n'en montre que l'ordre des distances. Un
  lieu sans coordonnées n'y figure pas — il n'est pas proche, il n'est nulle
  part sur la carte.

Le reste — le lien Mumble du jeu, la projection de la position dans les pixels
de continent — vit dans l'application, pas ici.

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
npm run meteo:simuler   # vérifie le moteur sur une année ; -- 240 pour moins, -- --base pour avancer
```

`meteo:simuler` tient lieu de suite de tests pour la simulation : géométrie,
horloge aux deux changements d'heure, bornes de chaque grandeur, présence des
six conditions sur une année, et **déterminisme** — deux passages doivent donner
le même résultat au chiffre près. Il sort en code 1 si une assertion tombe.

Sans argument il rejoue une **année tyrienne** à la cadence courante, quelle
qu'elle soit : le nombre de pas se déduit de `STEPS_PER_DAY`, il n'est pas écrit
en dur. Il imprime au passage la distribution des conditions et des phénomènes
sur toute la grille — c'est elle qui a fait remonter deux calibrations fausses,
le seuil d'orage et l'échelle du vent.

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
