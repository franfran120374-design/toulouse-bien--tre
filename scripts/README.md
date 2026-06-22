# Scripts d'import open data

J'ai vérifié les vrais champs renvoyés par l'API de Toulouse Métropole pour
trois datasets (495 aires de jeux, 473 fontaines à boire, 1385 équipements
sportifs dont 532 en accès libre) — le mapping dans `import-opendata.js`
est basé sur ces données réelles, pas deviné.

## Datasets utilisés

- `aires-de-jeux` → catégorie "Jeux pour enfants"
- `fontaines-a-boire` → catégorie "Fontaines à boire"
- `equipements-sportifs`, filtré sur `acces_libre = 'T'` et sur les types
  pertinents (street workout, skatepark, city-stades, terrains de sport en
  libre accès, parcours santé) → réparti sur plusieurs catégories

Tous les trois ne couvrent que **la ville de Toulouse**, pas le reste de
la métropole (voir le point soulevé plus haut dans la conversation).

## Dataset volontairement exclu : `espaces-verts`

Existe bien, mais contient 4293 entrées — jusqu'aux moindres bandes de
pelouse, pas une sélection de "parcs où se promener". L'importer tel quel
noierait la carte. Pour la catégorie "Parcs", deux options pour plus tard :
filtrer par surface (le dataset a un `geo_shape` polygonal, donc une aire
calculable), ou laisser cette catégorie se remplir par contribution +
ajout manuel des grands parcs connus (Jardin des Plantes, Prairie des
Filtres, Compans-Caffarelli...).

## Utilisation

```bash
cd scripts
npm install
cp .env.example .env
# remplis .env avec l'URL Supabase et la clé service_role
npm run import
```

## Pour explorer d'autres datasets toi-même

```bash
node inspect-opendata.js <dataset-id>
```

Affiche les champs réels d'un dataset avant d'écrire un mapping pour lui —
utile si tu veux ajouter d'autres communes de la métropole ou d'autres
catégories (boîtes à livres, jardins partagés...) plus tard. Le catalogue
complet se parcourt sur https://data.toulouse-metropole.fr/explore/
