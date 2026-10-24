import * as THREE from "three";

import {
  blocsDuTexte,
  creuxDe,
  inclinaisonDe,
  metresParPixel,
  TABLEAU_DISTANCE,
  TABLEAU_HAUTEUR,
} from "@/lib/board-vr";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  colorCss,
  contentBounds,
  headingSize,
  isRichKind,
  themeForFill,
  type BoardArrow,
  type BoardContent,
  type BoardElement,
} from "@/lib/boards";
import { isBlobUrl } from "@/lib/images";

/** La scène d'un panneau en VR, hors de React : three.js tient sa boucle de
 *  rendu, et une session WebXR n'a que faire d'un rendu de composant. Ce module
 *  ne se charge qu'à l'ouverture de la page (`import()`), pour que le panneau
 *  ordinaire ne télécharge pas un moteur 3D.
 *
 *  Rien de ce qui s'y déplace ne repart : les positions vivent dans la scène,
 *  et la quitter les oublie. */

export type VrScene = {
  /** Ouvre une session immersive. `immersive-ar` montre la pièce autour du
   *  tableau, là où le casque sait la filmer. */
  enter(mode: XRSessionMode): Promise<void>;
  /** Remet chaque élément à sa place sur le panneau. */
  reset(): void;
  dispose(): void;
};

type Options = {
  container: HTMLElement;
  content: BoardContent;
  /** Appelé quand une session commence ou finit. */
  onSession(active: boolean): void;
  /** Appelé au premier déplacement d'un élément depuis la dernière remise en place. */
  onMoved(moved: boolean): void;
};

/** L'épaisseur du liège, et l'écart entre deux éléments empilés : assez pour
 *  qu'ils ne se disputent pas le même plan, pas assez pour se voir. */
const LIEGE = 0.03;
const ECART_PLAN = 0.0006;
/** De combien un élément saisi se décolle du tableau. */
const DECOLLE = 0.025;
/** La marge de liège autour de ce que porte le panneau, en pixels du panneau. */
const MARGE = 120;
/** La définition des toiles : deux points par pixel, sans dépasser 1 536 de côté. */
const DEFINITION = 2;
const TOILE_MAX = 1536;

type Typo = { body: string; display: string };

/** Les jetons, lus là où ils vivent : une couleur du système n'a pas de valeur
 *  hors de la feuille de style, et la scène la demande au thème — celui de la
 *  page, ou celui qu'un fond libre impose (`themeForFill`). */
function lecteurDeJetons() {
  const probe = document.createElement("div");
  probe.style.display = "none";
  document.body.append(probe);
  return {
    color(css: string, theme?: "light" | "dark"): string | null {
      if (css === "transparent") return null;
      if (theme) probe.dataset.theme = theme;
      else delete probe.dataset.theme;
      probe.style.color = "";
      probe.style.color = css;
      return getComputedStyle(probe).color;
    },
    font(css: string): string {
      probe.style.fontFamily = css;
      return getComputedStyle(probe).fontFamily;
    },
    dispose() {
      probe.remove();
    },
  };
}

type Jetons = ReturnType<typeof lecteurDeJetons>;

/** Une image du magasin, chargée pour la toile. Le magasin la sert à toute
 *  origine ; si elle ne vient pas, l'élément garde son cadre et sa dimension. */
function chargerImage(src: string): Promise<HTMLImageElement | null> {
  if (!isBlobUrl(src)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/** Écrit des lignes dans un cadre, mot à mot ; ce qui déborde du bas se coupe,
 *  comme sur le panneau. Rend la hauteur écrite. */
function ecrire(
  ctx: CanvasRenderingContext2D,
  lignes: { text: string; font: string; size: number; lineHeight: number; indent?: number; marque?: string }[],
  box: { x: number; y: number; w: number; h: number },
  align: "left" | "center",
  gap: number,
): number {
  let y = box.y;
  ctx.textBaseline = "top";
  ctx.textAlign = align;
  for (const [index, ligne] of lignes.entries()) {
    if (index > 0) y += gap;
    ctx.font = ligne.font;
    const indent = ligne.indent ?? 0;
    const width = box.w - indent;
    const words = ligne.text.split(/\s+/).filter(Boolean);
    const rows: string[] = [];
    let row = "";
    for (const word of words) {
      const next = row ? `${row} ${word}` : word;
      if (row && ctx.measureText(next).width > width) {
        rows.push(row);
        row = word;
      } else {
        row = next;
      }
    }
    if (row || rows.length === 0) rows.push(row);
    const step = ligne.size * ligne.lineHeight;
    for (const [rowIndex, text] of rows.entries()) {
      if (y > box.y + box.h) return y - box.y;
      const offset = (step - ligne.size) / 2;
      if (rowIndex === 0 && ligne.marque) {
        ctx.textAlign = "left";
        ctx.fillText(ligne.marque, box.x, y + offset);
        ctx.textAlign = align;
      }
      const x = align === "center" ? box.x + box.w / 2 : box.x + indent;
      ctx.fillText(text, x, y + offset);
      y += step;
    }
  }
  return y - box.y;
}

/** Le dessin d'un élément sur une toile, à l'allure qu'il a sur le panneau :
 *  même fond, même trait, même encre. L'épingle, elle, est en relief. */
function dessiner(element: BoardElement, jetons: Jetons, typo: Typo, image: HTMLImageElement | null) {
  const ratio = Math.min(DEFINITION, TOILE_MAX / Math.max(element.w, element.h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(element.w * ratio);
  canvas.height = Math.ceil(element.h * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(ratio, ratio);

  const { w, h } = element;
  const theme = themeForFill(element.fill);
  const stroke = jetons.color(colorCss("stroke", element.stroke), theme) ?? "black";
  const ink = jetons.color(colorCss("ink", element.ink), theme) ?? "black";
  const rule = jetons.color("var(--rule)", theme);
  // Une note sans fond garde le vélin, comme sur le panneau ; un bloc de texte
  // aussi, ici : son encre posée à même le liège ne se lirait plus.
  const fill = isRichKind(element.kind) && element.fill === "aucun"
    ? jetons.color("var(--surface)", theme)
    : jetons.color(colorCss("fill", element.fill), theme);

  const riche = (box: { x: number; y: number; w: number; h: number }) => {
    const size = element.size;
    const titre = headingSize(size);
    const lignes = blocsDuTexte(element.text).map((bloc) =>
      bloc.kind === "titre"
        ? { text: bloc.text, font: `600 ${titre}px ${typo.display}`, size: titre, lineHeight: 1.2 }
        : {
            text: bloc.text,
            font: `${bloc.kind === "citation" ? "italic " : ""}${size}px ${typo.body}`,
            size,
            lineHeight: 1.45,
            indent: bloc.kind === "puce" ? size * 1.3 : bloc.kind === "citation" ? 14 : 0,
            marque: bloc.marque,
          },
    );
    ctx.fillStyle = ink;
    ecrire(ctx, lignes, box, "left", size * 0.4);
  };

  const legende = (box: { x: number; y: number; w: number; h: number }, align: "left" | "center") => {
    if (!element.text.trim()) return;
    ctx.fillStyle = ink;
    const lignes = element.text.split("\n").map((text) => ({
      text,
      font: `${element.size}px ${typo.body}`,
      size: element.size,
      lineHeight: 1.4,
    }));
    // La hauteur annoncée ne compte pas les retours à la ligne : seul le cadre
    // de l'élément borne ce qui s'écrit.
    ecrire(ctx, lignes, { ...box, h: element.h - box.y }, align, 0);
  };

  switch (element.kind) {
    case "note":
    case "texte": {
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(0, 0, w, h);
      }
      if (element.kind === "note" && rule) {
        ctx.strokeStyle = rule;
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
      riche(element.kind === "note" ? { x: 18, y: 26, w: w - 36, h: h - 42 } : { x: 16, y: 12, w: w - 32, h: h - 24 });
      ctx.restore();
      break;
    }
    case "image": {
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(0, 0, w, h);
      }
      const caption = element.caption.trim();
      const captionSize = 15;
      const captionHeight = caption ? Math.min(h / 2, captionSize * 1.45 * 2 + 16) : 0;
      const area = { x: 0, y: 0, w, h: h - captionHeight };
      if (image) {
        const scale = Math.min(area.w / image.naturalWidth, area.h / image.naturalHeight);
        const iw = image.naturalWidth * scale;
        const ih = image.naturalHeight * scale;
        ctx.drawImage(image, (area.w - iw) / 2, (area.h - ih) / 2, iw, ih);
      } else {
        // Rien d'inventé : le cadre dit la dimension qu'il attendait.
        ctx.fillStyle = jetons.color("var(--ink-muted)", theme) ?? ink;
        ctx.font = `15px ${typo.body}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${w} × ${h}`, area.w / 2, area.h / 2);
      }
      if (caption) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, area.h + 0.5);
        ctx.lineTo(w, area.h + 0.5);
        ctx.stroke();
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, area.h, w, captionHeight);
        ctx.clip();
        ctx.fillStyle = jetons.color("var(--ink-body)", theme) ?? ink;
        ecrire(
          ctx,
          [{ text: caption, font: `${captionSize}px ${typo.body}`, size: captionSize, lineHeight: 1.45 }],
          { x: 12, y: area.h + 8, w: w - 24, h: captionHeight - 16 },
          "left",
          0,
        );
        ctx.restore();
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      break;
    }
    case "triangle": {
      ctx.beginPath();
      ctx.moveTo(w / 2, 1);
      ctx.lineTo(w - 1, h - 1);
      ctx.lineTo(1, h - 1);
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      const inset = w * 0.22;
      const lignes = element.text.split("\n").filter(Boolean);
      const haut = lignes.length * element.size * 1.4;
      legende({ x: inset, y: h - 12 - haut, w: w - inset * 2, h: haut }, "center");
      break;
    }
    default: {
      // Carré et rond : la légende au milieu de la forme.
      ctx.beginPath();
      if (element.kind === "rond") ctx.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2);
      else ctx.rect(1, 1, w - 2, h - 2);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      const pad = element.kind === "rond" ? 16 : 8;
      const lignes = element.text.split("\n").filter(Boolean);
      const haut = lignes.length * element.size * 1.4;
      legende({ x: pad, y: Math.max(pad, (h - haut) / 2), w: w - pad * 2, h: haut }, "center");
      ctx.restore();
    }
  }
  return canvas;
}

/** L'étiquette d'une cordelette : sa légende sur un bout de papier. */
function etiquette(label: string, jetons: Jetons, typo: Typo) {
  const size = 16;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = `${size}px ${typo.body}`;
  const w = Math.ceil(ctx.measureText(label).width) + 16;
  const h = Math.ceil(size * 1.45) + 4;
  canvas.width = w * DEFINITION;
  canvas.height = h * DEFINITION;
  ctx.scale(DEFINITION, DEFINITION);
  ctx.fillStyle = jetons.color("var(--ground)") ?? "white";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = jetons.color("var(--rule)") ?? "black";
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.fillStyle = jetons.color("var(--ink-body)") ?? "black";
  ctx.font = `${size}px ${typo.body}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(label, w / 2, h / 2);
  return { canvas, w, h };
}

type Epingle = {
  element: BoardElement;
  group: THREE.Group;
  mesh: THREE.Mesh;
  /** Où il a été posé sur le panneau, et à quel plan. */
  origine: THREE.Vector2;
  rang: number;
};

type Cordelette = {
  arrow: BoardArrow;
  mesh: THREE.Mesh;
  tag: THREE.Mesh | null;
};

export async function createVrScene({ container, content, onSession, onMoved }: Options): Promise<VrScene> {
  const jetons = lecteurDeJetons();
  await document.fonts.ready;
  const typo: Typo = { body: jetons.font("var(--font-body)"), display: jetons.font("var(--font-display)") };

  const bounds = contentBounds(content.elements, MARGE) ?? { x: 0, y: 0, w: 1200, h: 800 };
  const echelle = metresParPixel(bounds);
  const largeur = bounds.w * echelle;
  const hauteur = bounds.h * echelle;
  // Un élément déplacé ne quitte pas le panneau : les bornes sont les siennes.
  const limites = {
    gauche: (0 - bounds.x - bounds.w / 2) * echelle,
    droite: (BOARD_WIDTH - bounds.x - bounds.w / 2) * echelle,
    haut: -(0 - bounds.y - bounds.h / 2) * echelle,
    bas: -(BOARD_HEIGHT - bounds.y - bounds.h / 2) * echelle,
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.xr.enabled = true;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";
  container.append(renderer.domElement);

  const fond = new THREE.Color(jetons.color("var(--ground)") ?? "black");
  const scene = new THREE.Scene();
  scene.background = fond;

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 50);
  const centre = new THREE.Vector3(0, TABLEAU_HAUTEUR, -TABLEAU_DISTANCE);

  const jetables: { dispose(): void }[] = [];
  function garder<T extends { dispose(): void }>(one: T): T {
    jetables.push(one);
    return one;
  }
  function couleur(css: string) {
    return new THREE.Color(jetons.color(css) ?? "black");
  }

  // Le sol, pour que le tableau tienne quelque part dans la pièce.
  const sol = new THREE.Mesh(
    garder(new THREE.PlaneGeometry(12, 12)),
    garder(new THREE.MeshBasicMaterial({ color: couleur("var(--surface-inset)") })),
  );
  sol.rotation.x = -Math.PI / 2;
  scene.add(sol);

  // Le tableau : un cadre, et le liège dedans.
  const tableau = new THREE.Group();
  tableau.position.copy(centre);
  scene.add(tableau);
  const cadre = new THREE.Mesh(
    garder(new THREE.BoxGeometry(largeur + 0.06, hauteur + 0.06, LIEGE)),
    garder(new THREE.MeshBasicMaterial({ color: couleur("var(--ink)") })),
  );
  tableau.add(cadre);
  const liege = new THREE.Mesh(
    garder(new THREE.PlaneGeometry(largeur, hauteur)),
    garder(new THREE.MeshBasicMaterial({ color: couleur("var(--gold)") })),
  );
  liege.position.z = LIEGE / 2 + 0.0005;
  tableau.add(liege);
  const surface = LIEGE / 2 + 0.002;

  // Les épingles : une tête ronde, une aiguille.
  const teteGeometry = garder(new THREE.SphereGeometry(0.008, 16, 12));
  const aiguilleGeometry = garder(new THREE.CylinderGeometry(0.0009, 0.0009, 0.014, 6));
  aiguilleGeometry.rotateX(Math.PI / 2);
  const aiguilleMaterial = garder(new THREE.MeshBasicMaterial({ color: couleur("var(--ink-muted)") }));
  const carmin = couleur("var(--crimson)");

  const images = await Promise.all(
    content.elements.map((element) => (element.kind === "image" ? chargerImage(element.src) : Promise.resolve(null))),
  );

  const ordre = [...content.elements].sort((a, b) => a.z - b.z);
  const epingles = new Map<string, Epingle>();
  for (const [rang, element] of ordre.entries()) {
    const image = images[content.elements.indexOf(element)];
    const texture = garder(new THREE.CanvasTexture(dessiner(element, jetons, typo, image)));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mesh = new THREE.Mesh(
      garder(new THREE.PlaneGeometry(element.w * echelle, element.h * echelle)),
      garder(new THREE.MeshBasicMaterial({ map: texture, transparent: true })),
    );
    mesh.userData.id = element.id;
    const group = new THREE.Group();
    group.add(mesh);
    group.rotation.z = inclinaisonDe(element.id);

    // L'épingle se plante où la note porte déjà sa pastille ; les autres
    // éléments, au milieu de leur bord haut. Elle prend le trait de la note,
    // et le carmin pour le reste.
    const tete = new THREE.Mesh(
      teteGeometry,
      garder(
        new THREE.MeshBasicMaterial({
          color:
            element.kind === "note"
              ? new THREE.Color(jetons.color(colorCss("stroke", element.stroke), themeForFill(element.fill)) ?? "black")
              : carmin,
        }),
      ),
    );
    const pique = (element.h / 2 - 14) * echelle;
    tete.position.set(0, pique, 0.014);
    const aiguille = new THREE.Mesh(aiguilleGeometry, aiguilleMaterial);
    aiguille.position.set(0, pique, 0.007);
    group.add(tete, aiguille);
    group.userData.epingle = tete;

    const origine = new THREE.Vector2(
      (element.x + element.w / 2 - bounds.x - bounds.w / 2) * echelle,
      -(element.y + element.h / 2 - bounds.y - bounds.h / 2) * echelle,
    );
    group.position.set(origine.x, origine.y, surface + rang * ECART_PLAN);
    tableau.add(group);
    epingles.set(element.id, { element, group, mesh, origine, rang });
  }
  let rangMax = ordre.length;

  // Les cordelettes, d'une épingle à l'autre. Une flèche à l'encre par défaut
  // devient le fil rouge du tableau de détective ; une couleur choisie se garde.
  const cordelettes: Cordelette[] = [];
  const parElement = new Map<string, Cordelette[]>();
  for (const arrow of content.arrows) {
    if (!epingles.has(arrow.from) || !epingles.has(arrow.to)) continue;
    const material = garder(
      new THREE.MeshBasicMaterial({
        color: arrow.color === "encre" ? carmin : couleur(colorCss("stroke", arrow.color)),
      }),
    );
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    tableau.add(mesh);
    let tag: THREE.Mesh | null = null;
    if (arrow.label) {
      const drawn = etiquette(arrow.label, jetons, typo);
      if (drawn) {
        const texture = garder(new THREE.CanvasTexture(drawn.canvas));
        texture.colorSpace = THREE.SRGBColorSpace;
        tag = new THREE.Mesh(
          garder(new THREE.PlaneGeometry(drawn.w * echelle, drawn.h * echelle)),
          garder(new THREE.MeshBasicMaterial({ map: texture })),
        );
        tag.rotation.z = inclinaisonDe(arrow.id);
        tableau.add(tag);
      }
    }
    const one = { arrow, mesh, tag };
    cordelettes.push(one);
    for (const id of [arrow.from, arrow.to]) parElement.set(id, [...(parElement.get(id) ?? []), one]);
  }

  const point = new THREE.Vector3();
  function bout(id: string) {
    const epingle = epingles.get(id)!;
    epingle.group.updateMatrix();
    return (epingle.group.userData.epingle as THREE.Mesh).getWorldPosition(point).clone().sub(tableau.position);
  }

  function tendre(corde: Cordelette) {
    const a = bout(corde.arrow.from);
    const b = bout(corde.arrow.to);
    const longueur = a.distanceTo(b);
    const milieu = a.clone().add(b).multiplyScalar(0.5);
    milieu.y -= creuxDe(longueur);
    milieu.z += 0.01;
    const courbe = new THREE.QuadraticBezierCurve3(a, milieu, b);
    corde.mesh.geometry.dispose();
    corde.mesh.geometry = new THREE.TubeGeometry(courbe, 32, 0.0016, 6, false);
    if (corde.tag) {
      corde.tag.position.copy(courbe.getPoint(0.5));
      corde.tag.position.z += 0.002;
    }
  }
  tableau.updateMatrixWorld(true);
  for (const corde of cordelettes) tendre(corde);

  // Le cadrage hors casque : le tableau entier dans la fenêtre, et un léger
  // tour autour de lui à la souris.
  const vue = { lacet: 0, tangage: 0, distance: 1 };
  function distanceDeCadrage() {
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    return Math.max((hauteur / 2 + 0.12) / tan, (largeur / 2 + 0.12) / (tan * camera.aspect));
  }
  function placerCamera() {
    const d = vue.distance * distanceDeCadrage();
    camera.position.set(
      centre.x + d * Math.sin(vue.lacet) * Math.cos(vue.tangage),
      centre.y + d * Math.sin(vue.tangage),
      centre.z + d * Math.cos(vue.lacet) * Math.cos(vue.tangage),
    );
    camera.lookAt(centre);
  }
  function redimensionner() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!renderer.xr.isPresenting) renderer.setSize(w, h);
    placerCamera();
  }
  const observer = new ResizeObserver(redimensionner);
  observer.observe(container);
  redimensionner();

  // La saisie : un rayon — celui de la souris, ou d'une manette — décroche
  // l'élément le plus proche, le promène sur le plan du tableau, et le
  // repose au premier plan.
  const raycaster = new THREE.Raycaster();
  const plan = new THREE.Plane();
  const touche = new THREE.Vector3();
  type Prise = { id: string; decalage: THREE.Vector2 };
  const prises = new Map<string, Prise>();
  let deplace = false;
  const meshes = () => [...epingles.values()].map((one) => one.mesh);

  function surLePlan(ray: THREE.Ray): THREE.Vector2 | null {
    plan.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, surface).add(tableau.position),
    );
    if (!ray.intersectPlane(plan, touche)) return null;
    return new THREE.Vector2(touche.x - tableau.position.x, touche.y - tableau.position.y);
  }

  function saisir(source: string, ray: THREE.Ray): boolean {
    raycaster.ray.copy(ray);
    const held = new Set([...prises.values()].map((prise) => prise.id));
    const hit = raycaster.intersectObjects(meshes(), false).find((one) => !held.has(one.object.userData.id));
    if (!hit) return false;
    const epingle = epingles.get(hit.object.userData.id as string)!;
    const sur = surLePlan(ray);
    if (!sur) return false;
    prises.set(source, {
      id: epingle.element.id,
      decalage: sur.sub(new THREE.Vector2(epingle.group.position.x, epingle.group.position.y)),
    });
    epingle.group.position.z = surface + rangMax * ECART_PLAN + DECOLLE;
    return true;
  }

  function promener(source: string, ray: THREE.Ray) {
    const prise = prises.get(source);
    if (!prise) return;
    const sur = surLePlan(ray);
    if (!sur) return;
    const epingle = epingles.get(prise.id)!;
    const x = THREE.MathUtils.clamp(sur.x - prise.decalage.x, limites.gauche, limites.droite);
    const y = THREE.MathUtils.clamp(sur.y - prise.decalage.y, limites.bas, limites.haut);
    if (x === epingle.group.position.x && y === epingle.group.position.y) return;
    epingle.group.position.x = x;
    epingle.group.position.y = y;
    for (const corde of parElement.get(prise.id) ?? []) tendre(corde);
    if (!deplace) {
      deplace = true;
      onMoved(true);
    }
  }

  function reposer(source: string) {
    const prise = prises.get(source);
    if (!prise) return;
    prises.delete(source);
    const epingle = epingles.get(prise.id)!;
    rangMax += 1;
    epingle.rang = rangMax;
    epingle.group.position.z = surface + rangMax * ECART_PLAN;
    for (const corde of parElement.get(prise.id) ?? []) tendre(corde);
  }

  // La souris, hors casque.
  const pointeur = new THREE.Vector2();
  let tourne: { x: number; y: number; lacet: number; tangage: number } | null = null;
  function rayonDe(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointeur.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointeur, camera);
    return raycaster.ray.clone();
  }
  function down(event: PointerEvent) {
    if (renderer.xr.isPresenting) return;
    renderer.domElement.setPointerCapture(event.pointerId);
    if (saisir(`pointeur-${event.pointerId}`, rayonDe(event))) return;
    tourne = { x: event.clientX, y: event.clientY, lacet: vue.lacet, tangage: vue.tangage };
  }
  function move(event: PointerEvent) {
    if (renderer.xr.isPresenting) return;
    if (prises.has(`pointeur-${event.pointerId}`)) {
      promener(`pointeur-${event.pointerId}`, rayonDe(event));
      return;
    }
    if (!tourne) return;
    const limite = THREE.MathUtils.degToRad(40);
    vue.lacet = THREE.MathUtils.clamp(tourne.lacet - (event.clientX - tourne.x) * 0.003, -limite, limite);
    vue.tangage = THREE.MathUtils.clamp(tourne.tangage + (event.clientY - tourne.y) * 0.003, -limite, limite);
    placerCamera();
  }
  function up(event: PointerEvent) {
    reposer(`pointeur-${event.pointerId}`);
    tourne = null;
  }
  function wheel(event: WheelEvent) {
    if (renderer.xr.isPresenting) return;
    event.preventDefault();
    vue.distance = THREE.MathUtils.clamp(vue.distance * Math.exp(event.deltaY * 0.001), 0.35, 2.5);
    placerCamera();
  }
  const canvas = renderer.domElement;
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", wheel, { passive: false });

  // Les manettes, dans le casque : chacune porte son rayon, et la gâchette
  // saisit. Les mains suivies émettent les mêmes gestes.
  const rayonGeometry = garder(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
  );
  const rayonMaterial = garder(new THREE.LineBasicMaterial({ color: couleur("var(--gold)") }));
  const manettes = [0, 1].map((index) => {
    const manette = renderer.xr.getController(index);
    const rayon = new THREE.Line(rayonGeometry, rayonMaterial);
    rayon.scale.z = 4;
    manette.add(rayon);
    scene.add(manette);
    const source = `manette-${index}`;
    manette.addEventListener("selectstart", () => saisir(source, rayonDeManette(manette)));
    manette.addEventListener("selectend", () => reposer(source));
    return { manette, source };
  });
  const rotation = new THREE.Matrix4();
  function rayonDeManette(manette: THREE.XRTargetRaySpace) {
    rotation.identity().extractRotation(manette.matrixWorld);
    const origin = new THREE.Vector3().setFromMatrixPosition(manette.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(rotation);
    return new THREE.Ray(origin, direction);
  }

  renderer.setAnimationLoop(() => {
    if (renderer.xr.isPresenting) {
      for (const { manette, source } of manettes) promener(source, rayonDeManette(manette));
    }
    renderer.render(scene, camera);
  });

  let session: XRSession | null = null;
  function finDeSession() {
    session = null;
    for (const { source } of manettes) reposer(source);
    scene.background = fond;
    sol.visible = true;
    tableau.position.copy(centre);
    tableau.updateMatrixWorld(true);
    redimensionner();
    onSession(false);
  }

  return {
    async enter(mode) {
      if (session || !navigator.xr) return;
      const next = await navigator.xr.requestSession(mode, {
        optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"],
      });
      // Sans repère au sol — un téléphone en réalité augmentée —, l'origine
      // est la tête : le tableau descend à sa hauteur.
      const auSol = await next.requestReferenceSpace("local-floor").then(
        () => true,
        () => false,
      );
      renderer.xr.setReferenceSpaceType(auSol ? "local-floor" : "local");
      tableau.position.set(centre.x, auSol ? centre.y : 0, centre.z);
      tableau.updateMatrixWorld(true);
      if (mode === "immersive-ar") {
        scene.background = null;
        sol.visible = false;
      }
      next.addEventListener("end", finDeSession, { once: true });
      session = next;
      await renderer.xr.setSession(next);
      onSession(true);
    },
    reset() {
      // Les plans aussi : le dernier saisi ne reste pas devant.
      for (const [rang, element] of ordre.entries()) {
        const epingle = epingles.get(element.id)!;
        epingle.rang = rang;
        epingle.group.position.set(epingle.origine.x, epingle.origine.y, surface + rang * ECART_PLAN);
      }
      rangMax = ordre.length;
      for (const corde of cordelettes) tendre(corde);
      deplace = false;
      onMoved(false);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      void session?.end().catch(() => undefined);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      for (const corde of cordelettes) corde.mesh.geometry.dispose();
      for (const one of jetables) one.dispose();
      renderer.dispose();
      canvas.remove();
      jetons.dispose();
    },
  };
}
