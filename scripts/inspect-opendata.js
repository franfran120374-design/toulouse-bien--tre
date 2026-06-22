// Usage : node inspect-opendata.js <dataset-id>
// Exemple : node inspect-opendata.js aires-de-jeux
//
// Sert juste à regarder à quoi ressemblent vraiment les champs renvoyés
// par l'API avant d'écrire le mapping dans import-opendata.js. Je n'ai
// pas pu vérifier les noms de champs exacts à l'avance (l'API ne s'inspecte
// pas via une simple recherche web), donc cette étape n'est pas optionnelle.

const datasetId = process.argv[2];

if (!datasetId) {
  console.error('Usage : node inspect-opendata.js <dataset-id>');
  console.error('Exemples de dataset-id à essayer : aires-de-jeux, fontaines-a-boire, equipements-sportifs');
  process.exit(1);
}

const url = `https://data.toulouse-metropole.fr/api/explore/v2.1/catalog/datasets/${datasetId}/records?limit=3`;

const res = await fetch(url);
if (!res.ok) {
  console.error(`Erreur HTTP ${res.status} pour ${url}`);
  process.exit(1);
}

const data = await res.json();

console.log(`Dataset : ${datasetId}`);
console.log(`Total d'enregistrements disponibles : ${data.total_count}`);
console.log('');
console.log('--- Premier enregistrement (tous les champs disponibles) ---');
console.log(JSON.stringify(data.results[0], null, 2));
console.log('');
console.log(
  "→ Repère ici les champs utiles : nom du lieu, adresse, et surtout la " +
    "géolocalisation (souvent un champ 'geo_point_2d' avec lat/lon, parfois " +
    "des colonnes séparées). Reporte ces noms exacts dans le mapping de " +
    "import-opendata.js."
);
