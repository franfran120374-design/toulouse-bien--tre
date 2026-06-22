// Import des deux derniers datasets open data Toulouse Métropole :
// - jardins-partages  -> catégorie "jardins-partages" (30 lieux)
// - stationnement-velo -> catégorie "stationnement-velo" (1969 arceaux)
//
// À lancer APRÈS avoir renommé la catégorie reparation-velo en
// stationnement-velo (voir migration SQL fournie). Sinon ce script ne
// trouvera pas la catégorie "stationnement-velo" et l'ignorera proprement.
//
// Usage : node import-opendata-extra.js

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Manque SUPABASE_URL ou SUPABASE_SERVICE_KEY dans scripts/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BASE = 'https://data.toulouse-metropole.fr/api/explore/v2.1/catalog/datasets';

async function fetchAllRecords(datasetId) {
  const all = [];
  let offset = 0;
  const limit = 100;
  for (let page = 0; page < 200; page++) {
    const res = await fetch(`${BASE}/${datasetId}/records?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${datasetId}`);
    const data = await res.json();
    all.push(...data.results);
    if (data.results.length < limit) break;
    offset += limit;
  }
  return all;
}

function coordsValides(r) {
  return r.geo_point_2d && Number.isFinite(r.geo_point_2d.lat) && Number.isFinite(r.geo_point_2d.lon);
}

async function inserer(label, lieux) {
  if (!lieux.length) {
    console.log(`${label} : rien à importer`);
    return;
  }
  let succes = 0;
  let echecs = 0;
  for (let i = 0; i < lieux.length; i += 200) {
    const paquet = lieux.slice(i, i + 200);
    const { error } = await supabase.from('lieux').insert(paquet);
    if (!error) {
      succes += paquet.length;
      continue;
    }
    console.error(`  Paquet refusé (${error.message}) — ligne par ligne…`);
    for (const lieu of paquet) {
      const { error: e } = await supabase.from('lieux').insert([lieu]);
      if (e) {
        echecs++;
        console.error(`    ✗ "${lieu.nom}" : ${e.message}`);
      } else succes++;
    }
  }
  console.log(`${label} : ${succes} importés` + (echecs ? `, ${echecs} échecs` : ''));
}

async function run() {
  const { data: categories, error } = await supabase.from('categories').select('id, slug');
  if (error) {
    console.error('Lecture catégories impossible :', error.message);
    process.exit(1);
  }
  const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  // --- Jardins partagés ---
  if (catBySlug['jardins-partages']) {
    const records = await fetchAllRecords('jardins-partages');
    const lieux = records.filter(coordsValides).map((r) => ({
      nom: r.nom || 'Jardin partagé',
      categorie_id: catBySlug['jardins-partages'],
      lat: r.geo_point_2d.lat,
      lng: r.geo_point_2d.lon,
      adresse: r.adresse || null,
      commune: r.commune || 'Toulouse',
      description: r.mis_a_dispo_de ? `Géré par : ${r.mis_a_dispo_de}` : null,
      source: 'opendata',
      statut_moderation: 'approuve',
    }));
    await inserer('jardins-partages', lieux);
  } else {
    console.log('Catégorie jardins-partages absente — ignorée.');
  }

  // --- Stationnement vélo ---
  if (catBySlug['stationnement-velo']) {
    const records = await fetchAllRecords('stationnement-velo');
    const lieux = records.filter(coordsValides).map((r) => ({
      nom: r.lib_voie
        ? `Arceaux vélo — ${[r.no, r.lib_voie].filter(Boolean).join(' ')}`
        : 'Stationnement vélo',
      categorie_id: catBySlug['stationnement-velo'],
      lat: r.geo_point_2d.lat,
      lng: r.geo_point_2d.lon,
      adresse: [r.no, r.lib_voie].filter(Boolean).join(' ') || null,
      commune: r.commune || 'Toulouse',
      description: r.nb_places ? `${r.nb_places} places` : null,
      source: 'opendata',
      statut_moderation: 'approuve',
    }));
    await inserer('stationnement-velo', lieux);
  } else {
    console.log(
      'Catégorie stationnement-velo absente — as-tu lancé la migration SQL de renommage ?'
    );
  }

  console.log('\nTerminé (open data extra).');
}

run();
