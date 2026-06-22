# Toulouse Bien-être

Carte communautaire des lieux et activités bien-être gratuits de Toulouse Métropole
(muscu extérieure, ping-pong, jeux pour enfants, fontaines, parcs, skateparks...).

## Stack

- React + Vite
- Leaflet / react-leaflet (tuiles OpenStreetMap)
- Supabase (Postgres + PostGIS + Auth + Row Level Security)
- PWA via `vite-plugin-pwa` (installable, cache des tuiles déjà vues)

## Mise en route

1. Crée un projet sur [supabase.com](https://supabase.com) (gratuit, sans CB).
2. Dans SQL Editor, colle et exécute `supabase_schema.sql` (fourni séparément).
   Ça crée les tables, les règles d'accès et les catégories de départ.
3. Copie `.env.example` en `.env.local` et remplis avec les valeurs de
   ton projet (Project Settings > API → "Project URL" et clé "anon / public").
4. Installe et lance :

   ```bash
   npm install
   npm run dev
   ```

5. Ouvre http://localhost:5173 — la carte doit s'afficher (vide au début,
   tant que tu n'as pas importé de données ou ajouté un lieu).

## Remplir la carte avec l'open data de Toulouse

Voir le dossier `scripts/` fourni séparément (`inspect-opendata.js` puis
`import-opendata.js`).

## Déploiement sur Render (gratuit)

1. Pousse ce projet sur un repo GitHub.
2. Sur Render : New > Static Site, connecte le repo.
3. Build command : `npm run build`
4. Publish directory : `dist`
5. Dans les "Environment Variables" du service Render, ajoute
   `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (les mêmes que ton
   `.env.local`) — c'est indispensable, Vite les inline au moment du build,
   pas à l'exécution.

Les sites statiques Render sont gratuits et ne se mettent jamais en veille
(contrairement aux "Web Services" gratuits, qui dorment après 15 min
d'inactivité) — donc parfaitement adapté à ce projet.

## Modération

Toute proposition d'ajout arrive avec `statut_moderation = 'en_attente'`.
Pour l'instant, tu valides/rejettes manuellement depuis Supabase Studio
(Table Editor > lieux) en passant le statut à `approuve` ou `rejete` — pas
besoin de coder un panel admin pour démarrer.

## Prochaines pistes (V2)

- Panel admin in-app (table `admins` + policies RLS dédiées) si le volume
  de modération dépasse ce qui est gérable depuis Studio.
- Cluster de marqueurs (`leaflet.markercluster`) quand le nombre de lieux
  devient important.
- Favoris, avis, boussole de guidage in-app.
