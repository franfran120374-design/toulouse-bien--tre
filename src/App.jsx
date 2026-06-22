import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabaseClient.js';
import Carte from './components/Carte.jsx';
import Filtres from './components/Filtres.jsx';
import FicheLieu from './components/FicheLieu.jsx';
import FormulaireAjout from './components/FormulaireAjout.jsx';
import AdminPanel from './components/AdminPanel.jsx';

export default function App() {
  // Petit "routeur" sans dépendance : l'URL #admin affiche le panel
  // de modération, tout le reste affiche la carte.
  const [vueAdmin, setVueAdmin] = useState(window.location.hash === '#admin');
  useEffect(() => {
    const onHash = () => setVueAdmin(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (vueAdmin) return <AdminPanel />;

  return <CarteApp />;
}

function CarteApp() {
  const [categories, setCategories] = useState([]);
  const [lieux, setLieux] = useState([]);
  const [categoriesActives, setCategoriesActives] = useState(null); // null = toutes
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [modeAjout, setModeAjout] = useState(false);
  const [nouveauPoint, setNouveauPoint] = useState(null); // { lat, lng } en attente de formulaire
  const [lieuSelectionne, setLieuSelectionne] = useState(null);


  const chargerDonnees = useCallback(async () => {
    setChargement(true);
    setErreur(null);

    const { data: cats, error: errCats } = await supabase
      .from('categories')
      .select('*')
      .order('nom');

    // Supabase plafonne une requête à 1000 lignes. Avec ~5000 lieux, il
    // faut paginer : on récupère par tranches de 1000 jusqu'à tout avoir.
    const PAGE = 1000;
    let tousLesLieux = [];
    let errLieux = null;
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase
        .from('lieux')
        .select('*')
        .eq('statut_moderation', 'approuve')
        .range(debut, debut + PAGE - 1);
      if (error) {
        errLieux = error;
        break;
      }
      tousLesLieux = tousLesLieux.concat(data);
      if (data.length < PAGE) break; // dernière page atteinte
    }

    if (errCats || errLieux) {
      setErreur((errCats || errLieux).message);
    } else {
      setCategories(cats || []);
      setLieux(tousLesLieux);
    }
    setChargement(false);
  }, []);

  useEffect(() => {
    chargerDonnees();
  }, [chargerDonnees]);

  const lieuxFiltres = lieux.filter(
    (l) => !categoriesActives || categoriesActives.includes(l.categorie_id)
  );

  function toggleCategorie(id) {
    setCategoriesActives((prev) => {
      const toutesActives = !prev;
      const base = toutesActives ? categories.map((c) => c.id) : prev;
      if (base.includes(id)) {
        const next = base.filter((c) => c !== id);
        return next;
      }
      return [...base, id];
    });
  }

  function handleClicCarte(latlng) {
    if (!modeAjout) return;
    setNouveauPoint(latlng);
  }

  function annulerAjout() {
    setModeAjout(false);
    setNouveauPoint(null);
  }

  async function soumettreNouveauLieu(lieu) {
    const { error } = await supabase.from('lieux').insert({
      ...lieu,
      lat: nouveauPoint.lat,
      lng: nouveauPoint.lng,
      source: 'contribution',
      statut_moderation: 'en_attente',
    });
    if (error) throw error;
    annulerAjout();
  }

  async function soumettreSignalement(lieuId, signalement) {
    const { error } = await supabase.from('signalements').insert({
      lieu_id: lieuId,
      ...signalement,
    });
    if (error) throw error;
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>🌿 Toulouse Bien-être</h1>
        {!modeAjout ? (
          <button className="btn" onClick={() => setModeAjout(true)}>
            + Ajouter un lieu
          </button>
        ) : (
          <button className="btn" onClick={annulerAjout}>
            Annuler l'ajout
          </button>
        )}
      </div>

      <Filtres
        categories={categories}
        categoriesActives={categoriesActives}
        onToggle={toggleCategorie}
      />

      {erreur && (
        <div className="confirmation" style={{ margin: 12, background: '#fef2f2', borderColor: '#dc2626', color: '#991b1b' }}>
          Erreur de chargement : {erreur}. Vérifie ton fichier .env.local et le schéma Supabase.
        </div>
      )}

      <div className="map-wrap">
        <Carte
          lieux={lieuxFiltres}
          categories={categories}
          modeAjout={modeAjout}
          pointEnAttente={nouveauPoint}
          onClicCarte={handleClicCarte}
          onClicLieu={setLieuSelectionne}
        />
      </div>

      {lieuSelectionne && (
        <FicheLieu
          lieu={lieuSelectionne}
          categorie={categories.find((c) => c.id === lieuSelectionne.categorie_id)}
          onFermer={() => setLieuSelectionne(null)}
          onSignaler={soumettreSignalement}
        />
      )}

      {nouveauPoint && (
        <FormulaireAjout
          categories={categories}
          point={nouveauPoint}
          onAnnuler={annulerAjout}
          onSoumettre={soumettreNouveauLieu}
        />
      )}

      {chargement && <p style={{ position: 'absolute', top: 90, left: 12 }}>Chargement…</p>}
    </div>
  );
}
