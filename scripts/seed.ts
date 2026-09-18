/**
 * Remplit la base avec un jeu de départ : des personnages, des lieux, des
 * évènements, des rumeurs et une météo. Il sert à voir le hub vivant en
 * développement, jamais à peupler la production.
 *
 *   npm run db:seed
 *
 * Le script est idempotent : il repart d'une base propre pour les collections
 * de contenu, et laisse les comptes tenus par Better Auth intacts.
 */

import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

import { connectToDatabase } from "@/lib/mongoose";
import { slugify } from "@/lib/slug";
import { Character } from "@/models/character";
import { Event } from "@/models/event";
import { Place } from "@/models/place";
import { Registration } from "@/models/registration";
import { Rumor } from "@/models/rumor";
import { User } from "@/models/user";
import { Weather } from "@/models/weather";

function inDays(days: number, hours: number, minutes = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

async function main() {
  await connectToDatabase();

  // Un compte doit exister : les contenus ont toujours un auteur.
  const author = await User.findOne().sort({ createdAt: 1 });
  if (!author) {
    throw new Error(
      "Aucun compte en base. Créez-en un sur /inscription avant de lancer le jeu de départ.",
    );
  }
  const authorId = String(author._id);

  await Promise.all([
    Character.deleteMany({}),
    Place.deleteMany({}),
    Event.deleteMany({}),
    Rumor.deleteMany({}),
    Registration.deleteMany({}),
    Weather.deleteMany({}),
  ]);

  const characters = await Character.insertMany(
    [
      {
        name: "Aeliane Vhaar",
        race: "humain",
        gender: "feminin",
        age: 27,
        title: "Séraphine en congé",
        tagline:
          "« Celle qui pose trop de questions » — on le dit surtout dans son dos, et surtout à raison.",
        summary:
          "Sergent des Séraphins en congé forcé, et qui pose beaucoup trop de questions.",
        story:
          "Née dans une ferme des Collines de Kessex, Aeliane est montée à la Lisière à seize ans avec une lettre de recommandation et des chaussures trop grandes.\n\nDouze ans de service, trois citations, aucune promotion au-delà du grade de sergent : elle a le défaut de poser des questions dont les réponses arrangent peu de monde.",
        appearance:
          "Grande, sèche, les cheveux coupés court à la diable. Elle porte encore son manteau de service dont elle a décousu les insignes.",
        homeRegion: "kryte",
        homePlaceLabel: "La Lisière de Divinité",
        birthplace: "Collines de Kessex",
        occupation: "Sergent des Séraphins",
        status: "En congé",
        birthDate: "3 Phénix 1305 AE",
      },
      {
        name: "Korrik Forgefer",
        race: "charr",
        gender: "masculin",
        age: 19,
        summary: "Légion de Fer, forgeron de campagne. Parle peu, cogne juste.",
        homeRegion: "ascalon",
        homePlaceLabel: "Citadelle Noire",
        occupation: "Forgeron de campagne",
      },
      {
        name: "Brenna Cœur-de-Givre",
        race: "norn",
        gender: "feminin",
        age: 34,
        summary: "Chasseuse d'ours qui raconte ses exploits en les améliorant un peu.",
        homeRegion: "shiverpeaks",
        homePlaceLabel: "Hoelbrak",
      },
      {
        name: "Zixx",
        race: "asura",
        gender: "neutre",
        age: 41,
        summary: "Vend des golems d'occasion avec une garantie de trois jours pleins.",
        homeRegion: "maguuma",
        homePlaceLabel: "Rata Sum",
      },
      {
        name: "Maren Fossebrune",
        race: "humain",
        gender: "feminin",
        age: 44,
        title: "Tenancière du Lion Noir",
        summary: "Sait tout, ne répète rien — sauf contre paiement.",
        homeRegion: "kryte",
        homePlaceLabel: "La Lisière de Divinité",
      },
    ].map((character) => ({ ...character, slug: slugify(character.name), authorId })),
  );

  const byName = new Map(characters.map((character) => [character.name, character]));

  const places = await Place.insertMany(
    [
      {
        name: "Taverne du Lion Noir",
        type: "taverne",
        region: "kryte",
        district: "Quartier du Port, La Lisière de Divinité",
        access: "Ouvert à tous",
        summary:
          "Salle basse voûtée, deux âtres, une mezzanine réservée aux capitaines.",
        description:
          "Trois générations de Fossebrune ont tenu cette salle basse voûtée, assez loin des quais pour échapper aux rondes, assez près pour que l'odeur de saumure entre avec les clients.\n\nLa maison sert une bière brune coupée d'épices de Maguuma et refuse obstinément le vin d'Orr.",
        coordinates: { x: 17_200, y: 15_400 },
        keeperCharacterId: byName.get("Maren Fossebrune")?._id,
        floorPlan: {
          points: [
            { number: 1, label: "Salle basse", description: "deux âtres, tables communes", x: 30, y: 60 },
            { number: 2, label: "Mezzanine des capitaines", description: "sur invitation", x: 62, y: 28 },
            { number: 3, label: "Réserve et cave", description: "une trappe vers les égouts", x: 20, y: 22 },
            { number: 4, label: "Cour arrière", description: "là où se règlent les querelles", x: 78, y: 72 },
          ],
        },
      },
      {
        name: "Grand hall du Corbeau",
        type: "guilde",
        region: "shiverpeaks",
        district: "Hoelbrak",
        access: "Sur invitation",
        summary: "Siège de la Guilde du Corbeau, où l'on parle plus qu'on ne chasse.",
        coordinates: { x: 19_800, y: 12_600 },
      },
      {
        name: "Ruines de Loncevallée",
        type: "ruine",
        region: "kryte",
        district: "Champs de Gendarran",
        access: "Ouvert à tous",
        summary: "Des murs sans toit, et quelque chose qui bouge la nuit.",
        coordinates: { x: 18_400, y: 16_900 },
      },
      {
        name: "Terrasse marchande",
        type: "commerce",
        region: "maguuma",
        district: "Rata Sum",
        access: "Ouvert à tous",
        summary: "Artefacts douteux, golems d'occasion et thé de Maguuma.",
        coordinates: { x: 15_100, y: 19_200 },
      },
    ].map((place) => ({ ...place, slug: slugify(place.name), authorId })),
  );

  const placeByName = new Map(places.map((place) => [place.name, place]));

  const events = await Event.insertMany(
    [
      {
        title: "Veillée au Lion Noir",
        type: "taverne",
        summary: "Contes, dés truqués et chansons de marins jusqu'au petit matin.",
        description:
          "Chaque fin de saison, la salle basse du Lion Noir se remplit de marins, de contrebandiers et de curieux venus écouter ceux qui reviennent de loin.\n\nLa soirée s'ouvre sur un tour de table libre : chacun peut prendre la parole pour un récit court.",
        practicalNotes: [
          "Ambiance légère, propice aux premières rencontres — aucun niveau d'écriture requis.",
          "Rendez-vous en jeu, canal /map — repli sur le salon vocal de la guilde si la zone sature.",
          "Pas de combat, pas de mort de personnage : les querelles se règlent aux dés ou dehors, hors scène.",
        ],
        startsAt: inDays(3, 20, 30),
        endsAt: inDays(3, 23, 30),
        placeId: placeByName.get("Taverne du Lion Noir")?._id,
        region: "kryte",
        coordinates: { x: 17_200, y: 15_400 },
        capacity: 20,
        organiserCharacterId: byName.get("Maren Fossebrune")?._id,
      },
      {
        title: "Chasse aux spectres d'Ascalon",
        type: "aventure",
        summary: "Une compagnie se forme pour escorter des pèlerins jusqu'aux ruines.",
        startsAt: inDays(6, 21),
        endsAt: inDays(6, 23, 30),
        placeId: placeByName.get("Ruines de Loncevallée")?._id,
        region: "kryte",
        coordinates: { x: 18_400, y: 16_900 },
        capacity: 12,
        organiserCharacterId: byName.get("Korrik Forgefer")?._id,
      },
      {
        title: "Marché aux curiosités",
        type: "commerce",
        summary: "Artefacts douteux, golems d'occasion et thé de Maguuma à prix d'ami.",
        startsAt: inDays(10, 19),
        placeId: placeByName.get("Terrasse marchande")?._id,
        region: "maguuma",
        coordinates: { x: 15_100, y: 19_200 },
        organiserCharacterId: byName.get("Zixx")?._id,
      },
      {
        title: "Conseil des porte-étendards",
        type: "ceremonie",
        summary: "Les guildes de Hoelbrak se comptent et se jaugent.",
        startsAt: inDays(4, 18),
        placeId: placeByName.get("Grand hall du Corbeau")?._id,
        region: "shiverpeaks",
        coordinates: { x: 19_800, y: 12_600 },
        capacity: 30,
      },
    ].map((event) => ({ ...event, slug: slugify(event.title), authorId })),
  );

  await Registration.create({
    eventId: events[0]._id,
    userId: authorId,
    characterId: byName.get("Maren Fossebrune")?._id,
    status: "inscrit",
  });

  await Rumor.insertMany([
    {
      body: "« Un séraphin aurait déserté son poste près de la porte de Beetletun, et personne n'ose en parler à la garde. »",
      characterId: byName.get("Aeliane Vhaar")?._id,
      placeId: placeByName.get("Taverne du Lion Noir")?._id,
      region: "kryte",
      echoedBy: [],
      echoCount: 12,
      authorId,
    },
    {
      body: "« Une lueur verte monte des ruines d'Ascalon trois nuits de suite. Les charrs disent que ce n'est pas un feu de camp. »",
      characterId: byName.get("Korrik Forgefer")?._id,
      region: "ascalon",
      echoedBy: [],
      echoCount: 9,
      authorId,
    },
    {
      body: "« Des caisses sans registre débarquent au quai neuf après la cloche du soir, et l'escorte porte l'uniforme. »",
      characterId: byName.get("Brenna Cœur-de-Givre")?._id,
      heardAtLabel: "Quai neuf",
      region: "kryte",
      echoedBy: [],
      echoCount: 21,
      authorId,
    },
  ]);

  await Weather.insertMany([
    {
      region: "kryte",
      condition: "pluie-fine",
      intensity: 40,
      startsAt: inDays(-1, 0),
      endsAt: inDays(5, 23),
      note: "crépuscule",
      authorId,
    },
    {
      region: "shiverpeaks",
      condition: "neige",
      intensity: 70,
      startsAt: inDays(-2, 0),
      endsAt: inDays(9, 23),
      authorId,
    },
  ]);

  console.log(
    `Jeu de départ posé : ${characters.length} personnages, ${places.length} lieux, ${events.length} évènements.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
