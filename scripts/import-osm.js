// Import depuis OpenStreetMap (via l'API Overpass) des catégories qui
// n'ont pas de dataset propre sur le portail de Toulouse Métropole :
// ping-pong, pique-nique, boîtes à livres, parcs, toilettes.
//
// OSM est sous licence ODbL (comme les données de Toulouse) : réutilisation
// libre, attribution "© les contributeurs OpenStreetMap" requise — c'est
// déjà affiché en bas de la carte via l'attribution Leaflet.
//
// Comme import-opendata.js, ce script utilise la clé service_role et écrit
// directement en statut "approuve". Même règle : la clé reste dans
// scripts/.env, jamais sur GitHub ni dans le frontend.
//
// Usage : node import-osm.js

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Manque SUPABASE_URL ou SUPABASE_SERVICE_KEY dans scripts/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const OVERPASS = 'https://overpass-api.de/api/interpreter';
// Bounding box élargie : toute la métropole et un peu autour (sud, ouest, nord, est)
const BBOX = '43.45,1.20,43.80,1.65';
const UA = 'ToulouseBienEtre/1.0 (import script)';

// Une entrée par catégorie : le slug Supabase + le filtre Overpass +
// comment construire un nom lisible quand l'élément OSM n'a pas de tag "name".
const SOURCES = [
  {
    slug: 'ping-pong',
    filtre: 'nwr["sport"="table_tennis"]',
    nomParDefaut: 'Table de ping-pong',
  },
  {
    slug: 'pique-nique',
    filtre: 'nwr["leisure"="picnic_table"];nwr["tourism"="picnic_site"]',
    nomParDefaut: 'Aire de pique-nique',
  },
  {
    slug: 'boites-a-livres',
    filtre: 'nwr["amenity"="public_bookcase"]',
    nomParDefaut: 'Boîte à livres',
  },
  {
    slug: 'parcs',
    // uniquement les parcs nommés : évite d'aspirer les milliers de
    // bouts de pelouse anonymes
    filtre: 'nwr["leisure"="park"]["name"]',
    nomParDefaut: 'Parc',
  },
  {
    slug: 'toilettes',
    filtre: 'nwr["amenity"="toilets"]',
    nomParDefaut: 'Toilettes publiques',
  },
  // Catégories ci-dessous : déjà présentes via l'open data Toulouse, mais
  // l'open data ne couvre que la ville. OSM les complète sur le reste de la
  // métropole. Les doublons éventuels (même point dans les deux sources)
  // sont retirés ensuite par dedup.sql.
  {
    slug: 'musculation',
    // tag OSM officiel des agrès de fitness en extérieur (pas les salles)
    filtre: 'nwr["leisure"="fitness_station"]',
    nomParDefaut: 'Espace fitness / street workout',
  },
  {
    slug: 'skatepark',
    filtre: 'nwr["leisure"="skatepark"];nwr["sport"="skateboard"]',
    nomParDefaut: 'Skatepark',
  },
  {
    slug: 'fontaines',
    filtre: 'nwr["amenity"="drinking_water"]',
    nomParDefaut: 'Fontaine à boire',
  },
];

function pause(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function interrogerOverpass(filtre, essai = 1) {
  // Chaque sous-filtre doit être terminé par ; à l'intérieur du groupe ( )
  const corps = filtre
    .split(';')
    .filter(Boolean)
    .map((f) => `${f}(${BBOX});`)
    .join('');
  const query = `[out:json][timeout:120];(${corps});out center;`;

  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });

  if (res.status === 429 || res.status === 504) {
    // rate-limit / surcharge : Overpass demande de ralentir
    if (essai > 4) throw new Error(`Overpass surchargé après ${essai} essais`);
    const attente = essai * 15000;
    console.log(`  Overpass occupé (${res.status}), nouvelle tentative dans ${attente / 1000}s…`);
    await pause(attente);
    return interrogerOverpass(filtre, essai + 1);
  }
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const data = await res.json();
  return data.elements || [];
}

function coordonnees(el) {
  if (el.type === 'node') return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function nettoieDetails(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (!s) continue;
    out[k] = s;
  }
  return Object.keys(out).length ? out : null;
}

// Traduit le tag OSM "access" en français lisible
function accesLisible(tags) {
  const a = tags.access;
  if (a === 'private') return 'Privé';
  if (a === 'customers') return 'Réservé aux clients';
  if (a === 'permissive' || a === 'yes' || !a) return 'Libre';
  return a;
}

async function inserer(slug, lieux) {
  if (!lieux.length) {
    console.log(`${slug} : rien à importer`);
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
  console.log(`${slug} : ${succes} importés` + (echecs ? `, ${echecs} échecs` : ''));
}

async function run() {
  const { data: categories, error } = await supabase.from('categories').select('id, slug');
  if (error) {
    console.error('Lecture catégories impossible :', error.message);
    process.exit(1);
  }
  const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  for (const source of SOURCES) {
    const categorie_id = catBySlug[source.slug];
    if (!categorie_id) {
      console.error(`Catégorie "${source.slug}" introuvable en base — ignorée.`);
      continue;
    }

    console.log(`Interrogation OSM pour ${source.slug}…`);
    const elements = await interrogerOverpass(source.filtre);

    const lieux = elements
      .map((el) => {
        const coord = coordonnees(el);
        if (!coord || !Number.isFinite(coord.lat) || !Number.isFinite(coord.lng)) return null;
        const tags = el.tags || {};
        return {
          nom: tags.name || source.nomParDefaut,
          categorie_id,
          lat: coord.lat,
          lng: coord.lng,
          adresse:
            [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ') || null,
          horaires: tags.opening_hours || null,
          accessible_pmr: tags.wheelchair === 'yes',
          details: nettoieDetails({
            Accès: accesLisible(tags),
            Tarif: tags.fee === 'yes' ? 'Payant' : tags.fee === 'no' ? 'Gratuit' : null,
            Gestionnaire: tags.operator || null,
          }),
          source: 'osm', // origine OpenStreetMap (distinct de l'open data Toulouse)
          statut_moderation: 'approuve',
        };
      })
      .filter(Boolean);

    await inserer(source.slug, lieux);
    // courtoisie envers le serveur public Overpass : on espace les requêtes
    await pause(8000);
  }

  console.log('\nTerminé (OSM).');
}

run();
