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
  le lecteur d'écran doit lire ce qui est écrit. L'idiome du dépôt est
  `toLocaleUpperCase("fr-FR")` sur le texte rendu. Plus une seule classe
  `uppercase` ne subsiste, et rien ne doit en réintroduire : un texte capitalisé
  par CSS ne se voit pas en relisant le code, seulement en relevant le
  `text-transform` calculé.
- **Les styles de texte sont ceux de `tokens.css`** — `.body`, `.meta`,
  `.section-title`… — pas un `text-[Npx]` réinventé. L'échelle ne couvre pas
  tout : elle n'a qu'une taille par rôle, donc les titres qui se réduisent sur
  téléphone gardent leur rampe responsive, et quelques tailles de libellé
  (11, 13, 14 px) n'y figurent pas. Ces cas-là attendent une décision du design
  system ; ils ne se règlent pas en écrivant une taille de plus.
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
Un pas toutes les deux heures — douze par jour — sur une grille de 160 × 224
cellules de 512 px, avancée par `/api/meteo/avancer` que Vercel déclenche
**toutes les heures**. `src/lib/weather/engine.ts` est une **fonction pure** —
aucune base, et jamais `Math.random()` : le hasard sort d'une graine rangée dans
l'état, sinon la frise de prévision mentirait.

Les taux du moteur sont écrits **pour six heures** et convertis à la cadence
(`parPas`, `fractionParPas`, `decroissanceParPas`). Une grandeur qui se relaxe
passe par `relaxe`, qui conserve le point fixe : diviser la source suffirait à
faire disparaître les orages. Les seuils vivent dans `SEUILS`, jamais nus au
milieu d'une condition.

**La finesse de la maille ne change pas le temps qu'il fait.** Les grandeurs
spatiales — rayon et vitesse d'un système, gradient de pression, distance
franchie par un front, dénivelé entre voisines — sont écrites pour une maille de
référence et converties par `parMaille` / `fractionParMaille`, exactement comme
les taux le sont pour la cadence. Sans cela, diviser la maille par deux
rétrécirait les dépressions de moitié et ralentirait les fronts d'autant.

Ce que la finesse change, en revanche, c'est la **concentration** : à chaque
division de la maille, la surface qui précipite tombe de moitié et la pointe de
précipitation monte. Même eau, moins étalée — et la pluie fine comme la neige,
comptées par cellule, suivent cette surface. Ce n'est pas un défaut de calibrage.

Une invariance de maille ne se vérifie **pas sur une seule partie** : le hasard se
consomme cellule par cellule, donc deux mailles ne jouent jamais la même météo, et
d'une graine à l'autre la pluie passe de 1,4 à 14 % des cellules. On rejoue les
**mêmes graines** aux deux mailles et on compare graine par graine.

Un pas coûte 701 Ko à cette maille, quatre fois plus qu'à 1 024 px. C'est pourquoi
l'historique se limite à **sept jours** : rien ne relit un pas ancien — on reprend
le dernier écrit, la prévision se rejoue en avant, et le rattrapage est plafonné à
trois jours. Le reste est une archive, et une archive n'a pas à quadrupler.

Un pas porte sa cadence **et sa maille** (`stepsPerDay`, `cellSize`). En changer
l'une ou l'autre rend les pas illisibles — la numérotation ne veut plus rien
dire, les champs sont empaquetés pour un autre nombre de cellules. Ils sont
**retirés** avant l'avancement, jamais repris, et la lecture filtre dessus :
entre un déploiement et le cron suivant, le dernier pas en base est illisible et
`unpackInt16` lèverait sur chaque page.

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
relevé pourrait mentir. La grille descend à l'écran en **un caractère par
cellule** — le rang du terrain — et non en liste d'objets : à 35 840 cellules,
c'est 35 Ko contre 1 093.

**L'ordre d'application des zones se modifie depuis l'administration**, et c'est
la dernière de la liste qui l'emporte. Un seul tri fait foi partout
(`ORDRE_DAPPLICATION`) : cuisson, liste et calque de carte — sinon l'écran et la
simulation raconteraient deux ordres différents. Un déplacement renumérote toute
la liste plutôt que de pousser un compteur, et le champ `rang` est facultatif
**sans valeur par défaut** : un défaut à zéro ferait gagner une zone sur ses
voisines sans rang au premier enregistrement du formulaire, sans que personne
l'ait demandé.

**L'ordre de `TERRAINS` est gravé** : le rang d'un terrain est l'entier écrit
dans les pas stockés. Un terrain nouveau s'ajoute à la fin, jamais au milieu.

Les champs de grille voyagent empaquetés en entiers 16 bits. Un tampon trop
court **lève** : relu en zéros, il donnerait un ciel dégagé partout, crédible et
faux.

Le calque de météo de `/carte` ne montre **pas la maille** : les cellules d'un
même phénomène sont recousues en une seule zone (`contours.ts`), qui porte son
symbole au milieu. Une grille dit « voici ma maille » ; un contour dit « il pleut
là », et c'est la seule chose que le lecteur ait à savoir. Une zone peut être
percée — un œil de ciel clair au milieu d'une averse — donc elle rend plusieurs
anneaux : le premier la cerne, les suivants la percent, et le symbole tombe
toujours sur une cellule de la tache, jamais dans un trou.

La légende ne liste que les phénomènes effectivement au ciel : pas d'entrée morte
un jour de beau temps. Vent fort et forte chaleur ne sont pas des conditions —
ils se cumulent à celle de la cellule.

**La sonde** (`SONDER`) relève le temps au point cliqué, par
`/api/meteo/point` : la grille entière ne peut pas voyager jusqu'au navigateur,
un relevé si. Elle se met en marche pour ne pas voler le clic qui choisit un
lieu, et s'éteindre retire le relevé avec sa croix.

**Sous `lg`, rien ne se pose sur la carte** hors les interrupteurs : légende et
bulletins descendent dans une bande sous la carte, qui occupe la moitié haute de
l'écran. Un panneau en surimpression calibré pour un écran large masque les deux
tiers d'un téléphone.

Le mobilier de Leaflet (attribution, zoom) est rebranché sur les jetons dans
`globals.css`. Ces règles-là sont **hors couche et volontairement spécifiques** :
`leaflet.css` est injectée après cette feuille, et sa variante `.leaflet-touch`
égale la spécificité naïve — donc reprend les angles vifs sur un téléphone.

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
