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

Un tracé se corrige de la même façon : ses sommets se glissent, et se déplacent
aux flèches une fois au clavier — d'une cellule de simulation, d'un dixième avec
`Maj`. Deux conséquences à ne pas défaire. Un sommet n'est **interactif que
lorsqu'il est saisissable** (`draggableVertices`) : inerte, il volerait à la
carte le clic qui pose le sommet suivant, et le tracé s'arrêterait dès qu'on
viserait près d'un sommet déjà posé. Et l'éditeur **cadre la carte sur le tracé**
qu'il ouvre (`initialFrame`) : à la vue par défaut, une zone posée ailleurs tombe
entièrement hors du cadre, et ses sommets ne sont ni visibles ni saisissables.

## La météo

Elle est **simulée**, pas écrite : personne ne pose un bulletin à la main.
Un pas toutes les deux heures — douze par jour — sur une grille de 320 × 448
cellules de 256 px, avancée par `/api/meteo/avancer` que Vercel déclenche
**toutes les heures**. `src/lib/weather/engine.ts` est une **fonction pure** —
aucune base, et jamais `Math.random()` : le hasard sort d'une graine rangée dans
l'état, sinon la frise de prévision mentirait.

Les taux du moteur sont écrits **pour six heures** et convertis à la cadence
(`parPas`, `fractionParPas`, `decroissanceParPas`). Une grandeur qui se relaxe
passe par `relaxe`, qui conserve le point fixe : diviser la source suffirait à
faire disparaître les orages. Les seuils vivent dans `SEUILS`, jamais nus au
milieu d'une condition.

La maille se double ou se divise par deux, jamais entre les deux : 81 920 = 2¹⁴ × 5
et 114 688 = 2¹⁴ × 7, donc seules les puissances de deux tombent juste sur les
deux côtés du continent.

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

Un pas coûte 2,73 Mo à cette maille, quatre fois plus qu'à 512 px — et sous cette
forme seulement : les mêmes champs en tableaux BSON **ne se sérialisent plus**,
ils dépassent les 16 Mo d'un document. L'empaquetage n'est plus une économie,
c'est ce qui rend le pas stockable.

L'historique se limite donc à ce qui peut encore servir, c'est-à-dire au
**plafond de rattrapage** : `RETENTION_JOURS = RATTRAPAGE_JOURS`, trois jours,
98 Mo. Rien ne relit un pas ancien — on reprend le dernier écrit, la prévision se
rejoue en avant, et au-delà du plafond un pas ne peut même plus servir à
rattraper. Ce n'est plus une archive, c'est du poids mort.

Rejouer la frise coûte 1,75 s à cette maille, et `/meteo` est rendue à la
requête. Elle est donc **calculée une fois par pas** (`frises`, dans
`src/server/queries/weather.ts`) : la frise ne dépend que du pas courant, donc le
numéro de pas est sa clé et il n'y a rien à faire expirer. Le cache vit dans
l'instance — sur une instance fraîche, le premier visiteur la paie encore.

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
simulation. Ce n'est pas une approximation, c'est une contrainte de dessin :
mesuré, une bande droite plus étroite que la cellule ne réclame **aucune**
cellule quand elle passe entre deux centres, et une bande en biais ne forme un
trait continu qu'à partir d'environ 1,4 fois la maille. **Une rivière se dessine
donc au moins aussi large que la cellule** — 256 px, 362 px en biais — sans quoi
elle apparaît en pointillé, ou pas du tout. Diviser la maille par deux ne fait
que diviser par deux cette largeur minimale ; élargir le tracé coûte moins cher.

`/admin/terrains` montre la grille cuite pour que ça se voie, et un clic sonde
un point : la zone qui le couvre, et celle que la simulation retient pour sa
cellule. Les deux passent par `zoneAt`, celui de la cuisson, sinon le relevé
pourrait mentir. La grille descend à l'écran en **un caractère par cellule** — le
rang du terrain — et non en liste d'objets : à 143 360 cellules, c'est 140 Ko
contre 4 805.

Une fois là, elle se dessine **par suites de cellules**, pas cellule par cellule.
Ces rectangles n'ont pas de trait, donc deux voisines de même terrain ne se
distinguent déjà pas et les recoudre ne change pas un pixel — mesuré, l'image est
identique au bit près. Mais l'écran passe de 139 426 calques et 11,7 s à 1 040 et
2,2 s, et le clic de sonde de 261 à 26 ms. Un rectangle par cellule ne tient plus
à cette maille.

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

**Un clic sur la carte relève le temps au point cliqué**, par
`/api/meteo/point` : la grille entière ne peut pas voyager jusqu'au navigateur,
un relevé si. C'est le comportement par défaut, sans interrupteur à armer — un
clic sur la carte a toujours voulu dire « qu'est-ce qu'il y a là ? ». La croix se
pose avant la réponse, et le relevé la rejoint.

Le même cartouche porte **ce qu'on peut poser là** : un lieu, une scène, une
rumeur. Les deux premiers emportent le point dans l'adresse (`?x=…&y=…`), que
`readPointParam` relit et que le formulaire ouvre avec sa carte déjà cadrée
dessus — sinon il faudrait repointer ce qu'on vient de pointer. Et à travers la
connexion : le chemin complet, coordonnées comprises, part dans `suite`. La
rumeur, elle, n'a pas de point à elle ; elle emporte la **région** du relevé
(`?ou=…`, distinct du `region` qui filtre la liste), qui est ce que le tableau
des rumeurs sait retenir d'un endroit.

Le point posé et le pin choisi se disputeraient le même coin de l'écran :
choisir l'un retire l'autre.

**Les bulletins de région ne sont plus sur la carte** : « Dégagé sur Kryte »
répété six fois occupait un tiers de l'écran pour dire ce que les taches disent
déjà en couleur. Le détail chiffré reste sur `/meteo`.

**Sous `lg`, rien ne se pose sur la carte** hors les interrupteurs : légende et
relevé descendent dans une bande sous la carte, qui occupe la moitié haute de
l'écran. Un panneau en surimpression calibré pour un écran large masque les deux
tiers d'un téléphone.

La colonne de gauche est la **liste**, pas ses commandes : les filtres de type
tiennent sur une seule ligne qui défile — empilés, les types prenaient trois
rangs — et le pied de colonne range le compte, la météo et la proposition sur
une ligne. Un bouton pleine largeur y valait la hauteur de trois lieux.

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

**Un texte long porte ses propres images**, pas seulement sa bannière : l'éditeur
en téléverse par le même chemin, et le markdown enregistré les écrit
`![alternative](adresse)`. Elles comptent donc dans le ménage —
`collectMarkdownImages` les relit, et `deleteOrphanedImages` compare ce que le
contenu portait à ce qu'il porte encore. Comparer les deux listes plutôt que
supprimer l'ancienne évite d'emporter une image seulement déplacée d'un
paragraphe à l'autre.

**À la lecture, une image ne s'affiche que si elle vient du magasin**
(`isBlobUrl`). Une adresse quelconque collée dans un champ ferait du texte d'un
membre une requête vers le serveur d'un autre — pixel de suivi compris — et rien
ne garantirait qu'elle réponde encore demain.

**L'alternative se saisit avant le fichier**, et le bouton reste fermé tant
qu'elle manque : une image posée sans elle ne dit plus rien à qui ne la voit pas,
et il faudrait la retirer pour la reposer — le markdown ne se corrige pas à la
souris.

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
