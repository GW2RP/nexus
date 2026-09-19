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
- **Pas de texte d'explication.** Un état vide porte son titre et rien d'autre ;
  une section ne se présente pas, elle se montre. Si une phrase n'apprend rien
  que l'écran ne dise déjà, elle saute.
- **Les dates** : la date réelle en premier, la date tyrienne en second. Les
  heures sont celles du serveur de jeu (`Europe/Paris`) et sont affichées comme
  telles.
- **L'interface est en français**, contenu, libellés, messages d'erreur et
  commentaires de code compris.

## La carte

Les coordonnées sont des pixels de continent. L'échelle de `continent_dims`
est portée par le **zoom 7**, pas par le `max_zoom: 8` que l'API annonce :
`COORDINATE_ZOOM` dans `src/lib/map.ts` fait foi pour tout `project` /
`unproject`. Un emplacement se pose en cliquant la carte, jamais en tapant deux
nombres.

## La météo

Elle est **simulée**, pas écrite : personne ne pose un bulletin à la main.
Un pas toutes les deux heures — douze par jour — sur une grille de 40 × 56
cellules de 2 048 px, avancée par `/api/meteo/avancer` que Vercel déclenche
**toutes les heures**. `src/lib/weather/engine.ts` est une **fonction pure** —
aucune base, et jamais `Math.random()` : le hasard sort d'une graine rangée dans
l'état, sinon la frise de prévision mentirait.

Les taux du moteur sont écrits **pour six heures** et convertis à la cadence
(`parPas`, `fractionParPas`, `decroissanceParPas`). Une grandeur qui se relaxe
passe par `relaxe`, qui conserve le point fixe : diviser la source suffirait à
faire disparaître les orages. Les seuils vivent dans `SEUILS`, jamais nus au
milieu d'une condition.

Un pas porte sa cadence (`stepsPerDay`). En changer renumérote tout : les pas
d'une autre cadence sont **retirés** avant l'avancement, jamais repris.

Deux règles de fuseau, à ne pas défaire :

- La route **ne lit jamais son heure de déclenchement**. Vercel évalue le cron en
  UTC et dérive d'une heure à l'heure d'été ; on lit l'horloge d'`Europe/Paris`
  et on rattrape les pas dus.
- La date d'un pas se lit sur son **jour civil parisien**
  (`civilDayOfStep`), jamais sur son instant : la tranche de nuit commence à
  22 h ou 23 h UTC la veille, et `toTyrianDate` calcule en UTC.

Le terrain se cuit depuis les zones à chaque avancement, jamais stocké cuit :
rien à invalider, donc rien qui puisse être périmé. Une cellule se juge par son
**centre** — une zone trop petite pour en couvrir un n'existe pas pour la
simulation. `/admin/terrains` montre la grille cuite pour que ça se voie, et un
clic sonde un point : la zone qui le couvre, et celle que la simulation retient
pour sa cellule. Les deux passent par `zoneAt`, celui de la cuisson, sinon le
relevé pourrait mentir.

**L'ordre de `TERRAINS` est gravé** : le rang d'un terrain est l'entier écrit
dans les pas stockés. Un terrain nouveau s'ajoute à la fin, jamais au milieu.

Les champs de grille voyagent empaquetés en entiers 16 bits. Un tampon trop
court **lève** : relu en zéros, il donnerait un ciel dégagé partout, crédible et
faux.

Le calque de météo de `/carte` ne teinte que les cellules qui portent un
phénomène, et sa légende ne liste que ceux effectivement au ciel : pas d'entrée
morte un jour de beau temps. Vent fort et forte chaleur ne sont pas des
conditions — ils se cumulent à celle de la cellule.

**Un seuil se relève sur les cellules en région**, jamais sur le rectangle du
continent : la mer en couvre 96 %, et une moyenne prise là décrit un océan.
C'est cette confusion de population qui rendait l'orage, la forte chaleur et le
vent fort impossibles sur les terres du hub. Pour la même raison, le gradient de
température s'étale sur la **bande habitée** (`BANDE_NORD` / `BANDE_SUD`) et se
borne au-delà.

## Les images

Une image téléversée vit dans Vercel Blob, pas en base. Elle est rangée sous son
auteur : `<dossier>/<id de l'auteur>/<fichier>`. La route de téléversement refuse
tout autre chemin, et `deleteUploadedImages` refuse de supprimer une adresse
rangée sous quelqu'un d'autre — sans quoi il suffirait de recopier l'adresse
d'autrui dans un champ image pour la faire effacer.

Tout chemin qui retire une image d'un contenu — suppression de la fiche,
remplacement, suppression de modération — passe par `deleteUploadedImages`. Il ne
touche jamais une adresse étrangère au magasin, et ne fait jamais échouer son
appelant.

## Frontières

- `src/server/**` ne s'importe jamais depuis un composant client. L'état de
  formulaire partagé vit dans `src/lib/action-state.ts`.
- Les requêtes (`src/server/queries`) renvoient des objets simples sérialisés,
  jamais des documents Mongoose.
- Les écritures passent par des actions serveur validées par Zod
  (`src/server/actions`), qui vérifient le rôle avant d'écrire.
- Une page qui lit la session est rendue à la requête. Ne jamais lui adjoindre
  `generateStaticParams` ni `revalidate` : la route se met en contradiction avec
  elle-même et échoue en `DYNAMIC_SERVER_USAGE`.

## Avant de pousser

```bash
npm run typecheck && npm run lint && npm run build
```
