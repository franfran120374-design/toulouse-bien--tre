// Import des datasets open data de Toulouse Métropole vers la table `lieux`.
//
// J'ai vérifié les vrais champs de l'API avant d'écrire ce mapping (pas de
// devinette) : aires-de-jeux (495 lieux), fontaines-a-boire (473 lieux),
// equipements-sportifs (1385 équipements, dont 532 en accès libre).
//
// Important : ce script utilise la clé "service_role" de Supabase, qui
// CONTOURNE Row Level Security. C'est volontaire (on importe avec le statut
// "approuve" directement, sans passer par la file de modération) mais ça
// veut dire que cette clé ne doit JAMAIS atterrir dans le frontend ou sur
// GitHub. Garde-la uniquement dans scripts/.env (qui est dans .gitignore).
//
// Usage : npm install puis node import-opendata.js

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Manque SUPABASE_URL ou SUPABASE_SERVICE_KEY dans scripts/.env');
  console.error('(clé "service_role", visible dans Project Settings > API > service_role)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BASE = 'https://data.toulouse-metropole.fr/api/explore/v2.1/catalog/datasets';

async function fetchAllRecords(datasetId) {
  const all = [];
  let offset = 0;
  const limit = 100;
  // garde-fou pour ne jamais boucler à l'infini si l'API change de forme
  for (let page = 0; page < 200; page++) {
    const url = `${BASE}/${datasetId}/records?limit=${limit}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${datasetId}`);
    const data = await res.json();
    all.push(...data.results);
    if (data.results.length < limit) break;
    offset += limit;
  }
  return all;
}

function aDesCoordonneesValides(r) {
  return (
    r.geo_point_2d &&
    Number.isFinite(r.geo_point_2d.lat) &&
    Number.isFinite(r.geo_point_2d.lon)
  );
}

function nettoyerInfobulle(html) {
  if (!html) return null;
  return html
    .replace(/<hr>|<br>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

// Equipements sportifs à conserver : uniquement ce qui correspond à du
// bien-être/sport gratuit en plein air. Tout le reste (gymnases, dojos,
// courts de tennis réservables, piscines...) est volontairement exclu.
const TYPE_EQUIPEMENT_VERS_CATEGORIE = {
  'Aire de fitness/street workout': 'musculation',
  Skatepark: 'skatepark',
  Pumptrack: 'skatepark',
  'Parkour/blocpark': 'skatepark',
  'Multisports/City-stades': 'terrains-sport',
  'Terrain de basket-ball': 'terrains-sport',
  'Terrain de basket-ball 3x3': 'terrains-sport',
  'Terrain de football': 'terrains-sport',
  'Terrain de foot 5x5': 'terrains-sport',
  'Terrain de handball': 'terrains-sport',
  'Terrain de volley-ball': 'terrains-sport',
  'Terrain de beach-volley': 'terrains-sport',
  'Terrain de pétanque': 'terrains-sport',
  'Terrain de boules': 'terrains-sport',
  'Parcours sportif/santé': 'parcours-sante',
};

async function importerAiresDeJeux(catBySlug) {
  const records = await fetchAllRecords('aires-de-jeux');
  return records
    .filter(aDesCoordonneesValides)
    .map((r) => ({
      nom: r.nom || 'Aire de jeux',
      categorie_id: catBySlug['jeux-enfants'],
      lat: r.geo_point_2d.lat,
      lng: r.geo_point_2d.lon,
      adresse: r.adresse || null,
      commune: r.commune || 'Toulouse',
      description: r.ombrage ? `Ombrage : ${r.ombrage}` : null,
      source: 'opendata',
      statut_moderation: 'approuve',
    }));
}

async function importerFontaines(catBySlug) {
  const records = await fetchAllRecords('fontaines-a-boire');
  return records
    .filter(aDesCoordonneesValides)
    .map((r) => ({
      nom: r.localisation || 'Fontaine à boire',
      categorie_id: catBySlug['fontaines'],
      lat: r.geo_point_2d.lat,
      lng: r.geo_point_2d.lon,
      adresse: r.adresse || null,
      commune: r.commune || 'Toulouse',
      description: r.type ? `Type : ${r.type}` : null,
      source: 'opendata',
      statut_moderation: 'approuve',
    }));
}

async function importerEquipementsSportifs(catBySlug) {
  const records = await fetchAllRecords('equipements-sportifs');
  return records
    .filter(aDesCoordonneesValides)
    .filter((r) => r.acces_libre === 'T') // uniquement l'accès libre, pas les équipements réservables
    .filter((r) => TYPE_EQUIPEMENT_VERS_CATEGORIE[r.type_equipement])
    .map((r) => ({
      nom: r.nom_equipement ? `${r.nom_installation} — ${r.nom_equipement}` : r.nom_installation,
      categorie_id: catBySlug[TYPE_EQUIPEMENT_VERS_CATEGORIE[r.type_equipement]],
      lat: r.geo_point_2d.lat,
      lng: r.geo_point_2d.lon,
      adresse: r.adresse || null,
      commune: 'Toulouse', // ce dataset ne couvre que la ville de Toulouse
      description: nettoyerInfobulle(r.infobulle),
      accessible_pmr: r.accessibilite_psh === 1,
      source: 'opendata',
      statut_moderation: 'approuve',
    }));
}

async function inserer(label, lieux) {
  if (!lieux.length) {
    console.log(`${label} : rien à importer`);
    return;
  }

  let succes = 0;
  let echecs = 0;
  const taillePaquet = 200; // plus petit qu'avant, pour limiter les dégâts si un paquet échoue

  for (let i = 0; i < lieux.length; i += taillePaquet) {
    const paquet = lieux.slice(i, i + taillePaquet);
    const { error } = await supabase.from('lieux').insert(paquet);

    if (!error) {
      succes += paquet.length;
      continue;
    }

    // Le paquet entier a été refusé : on retente ligne par ligne pour
    // isoler précisément la/les lignes fautives sans perdre les bonnes.
    console.error(`  Paquet refusé sur "${label}" (${error.message}) — isolation ligne par ligne…`);
    for (const lieu of paquet) {
      const { error: errLigne } = await supabase.from('lieux').insert([lieu]);
      if (errLigne) {
        echecs++;
        console.error(`    ✗ "${lieu.nom}" :`, errLigne.message);
      } else {
        succes++;
      }
    }
  }

  console.log(
    `${label} : ${succes} lieux importés` + (echecs ? `, ${echecs} échecs (détails ci-dessus)` : '')
  );
}

async function run() {
  const { data: categories, error: errCat } = await supabase.from('categories').select('id, slug');
  if (errCat) {
    console.error('Impossible de lire les catégories :', errCat.message);
    process.exit(1);
  }
  const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  await inserer('aires-de-jeux → jeux-enfants', await importerAiresDeJeux(catBySlug));
  await inserer('fontaines-a-boire → fontaines', await importerFontaines(catBySlug));
  await inserer('equipements-sportifs → plusieurs catégories', await importerEquipementsSportifs(catBySlug));

  console.log('\nTerminé.');
}

run();
