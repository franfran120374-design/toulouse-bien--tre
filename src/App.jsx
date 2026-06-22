import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from './lib/supabaseClient.js';
import Carte from './components/Carte.jsx';
import Filtres from './components/Filtres.jsx';
import FiltresAvances from './components/FiltresAvances.jsx';
import FicheLieu from './components/FicheLieu.jsx';
import FormulaireAjout from './components/FormulaireAjout.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import Aide from './components/Aide.jsx';
import opening_hours from 'opening_hours';
import { lireFavoris, basculerFavori } from './lib/favoris.js';

// Helpers de filtrage avancé, définis hors composant pour rester stables.
function estOuvertMaintenant(lieu) {
  // Pas d'horaires = accès permanent => considéré ouvert
  if (!lieu.horaires) return true;
  try {
    return new opening_hours(lieu.horaires).getState(new Date());
  } catch {
    // Format d'horaire non interprétable : on n'exclut pas (on l'affiche)
    return true;
  }
}

function estOmbrage(lieu) {
  const o = lieu.details?.Ombrage;
  if (!o) return false;
  const t = String(o).toLowerCase();
  return !t.includes('non') && !t.includes('aucun') && !t.includes('sans');
}

// Distance en mètres entre deux points GPS (formule de Haversine)
function distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Lit l'id de lieu dans l'URL si on est arrivé sur /lieu/xxxx
function lieuIdDepuisUrl() {
  const m = window.location.pathname.match(/^\/lieu\/([0-9a-fA-F-]+)/);
  return m ? m[1] : null;
}

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
  const [categoriesActives, setCategoriesActives] = useState([]); // [] = rien de sélectionné au départ
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  const [modeAjout, setModeAjout] = useState(false);
  const [nouveauPoint, setNouveauPoint] = useState(null); // { lat, lng } en attente de formulaire
  const [lieuSelectionne, setLieuSelectionne] = useState(null);
  const [aideVisible, setAideVisible] = useState(true);
  const [filtresAv, setFiltresAv] = useState({ pmr: false, ouvert: false, ombrage: false });

  // Géolocalisation "autour de moi"
  const [posUser, setPosUser] = useState(null); // { lat, lng }
  const [rayon, setRayon] = useState(500); // mètres
  const [autourActif, setAutourActif] = useState(false);
  const [geoErreur, setGeoErreur] = useState(null);

  // Favoris (stockés sur l'appareil)
  const [favoris, setFavoris] = useState(lireFavoris());
  const [vueFavoris, setVueFavoris] = useState(false); // n'afficher que les favoris

  function toggleFavori(id) {
    setFavoris(basculerFavori(id));
  }


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

  // Si on est arrivé sur /lieu/xxx, ouvrir cette fiche une fois les lieux chargés
  useEffect(() => {
    const id = lieuIdDepuisUrl();
    if (id && lieux.length) {
      const l = lieux.find((x) => x.id === id);
      if (l) setLieuSelectionne(l);
    }
  }, [lieux]);

  // Bouton "précédent" du navigateur : resynchronise la fiche ouverte
  useEffect(() => {
    const onPop = () => {
      const id = lieuIdDepuisUrl();
      setLieuSelectionne(id ? lieux.find((x) => x.id === id) || null : null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [lieux]);

  function ouvrirLieu(lieu) {
    setLieuSelectionne(lieu);
    // met à jour l'URL sans recharger la page
    window.history.pushState({}, '', `/lieu/${lieu.id}`);
  }

  function fermerLieu() {
    setLieuSelectionne(null);
    window.history.pushState({}, '', '/');
  }

  function activerAutourDeMoi() {
    if (!navigator.geolocation) {
      setGeoErreur('Géolocalisation non disponible sur cet appareil.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosUser({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAutourActif(true);
        setGeoErreur(null);
      },
      () => setGeoErreur("Position refusée. Autorise la localisation pour utiliser 'Autour de moi'.")
    );
  }

  // Mode favoris : on affiche uniquement les lieux épinglés (toutes catégories).
  // Sinon : aucune catégorie cochée = carte vide (l'utilisateur choisit).
  const lieuxFiltres = lieux.filter((l) => {
    if (vueFavoris) {
      if (!favoris.includes(l.id)) return false;
    } else {
      if (!categoriesActives.includes(l.categorie_id)) return false;
    }
    if (filtresAv.pmr && !l.accessible_pmr) return false;
    if (filtresAv.ouvert && !estOuvertMaintenant(l)) return false;
    if (filtresAv.ombrage && !estOmbrage(l)) return false;
    if (autourActif && posUser) {
      if (distanceM(posUser.lat, posUser.lng, l.lat, l.lng) > rayon) return false;
    }
    return true;
  });

  function toggleFiltreAvance(cle) {
    setFiltresAv((prev) => ({ ...prev, [cle]: !prev[cle] }));
  }

  function toggleCategorie(id) {
    setCategoriesActives((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
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
      {aideVisible && <Aide onFermer={() => setAideVisible(false)} />}
      <div className="topbar">
        <h1>🌿 Toulouse Bien-être</h1>
        <button
          className="btn"
          onClick={() => setAideVisible(true)}
          title="Aide"
        >
          ?
        </button>
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

      <FiltresAvances valeurs={filtresAv} onToggle={toggleFiltreAvance} />

      <div className="filtres" style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
        <button
          className={`filtre-chip ${vueFavoris ? 'actif' : ''}`}
          onClick={() => setVueFavoris((v) => !v)}
        >
          ⭐ Mes favoris {favoris.length > 0 && `(${favoris.length})`}
        </button>
        <button
          className={`filtre-chip ${autourActif ? 'actif' : ''}`}
          onClick={() => (autourActif ? setAutourActif(false) : activerAutourDeMoi())}
        >
          📍 Autour de moi
        </button>
        {autourActif && (
          <>
            {[300, 500, 1000].map((r) => (
              <button
                key={r}
                className={`filtre-chip ${rayon === r ? 'actif' : ''}`}
                onClick={() => setRayon(r)}
              >
                {r < 1000 ? `${r} m` : '1 km'}
              </button>
            ))}
          </>
        )}
      </div>

      {geoErreur && (
        <div className="confirmation" style={{ margin: 12, background: '#fef2f2', borderColor: '#dc2626', color: '#991b1b' }}>
          {geoErreur}
        </div>
      )}

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
          onClicLieu={ouvrirLieu}
          posUser={autourActif ? posUser : null}
          rayon={rayon}
        />
        {categoriesActives.length === 0 && !vueFavoris && !modeAjout && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              zIndex: 1000,
              background: '#16a34a',
              color: 'white',
              padding: '10px 14px',
              borderRadius: 8,
              textAlign: 'center',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            👆 Choisis une ou plusieurs catégories ci-dessus pour afficher les lieux
          </div>
        )}
        {vueFavoris && favoris.length === 0 && !modeAjout && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              zIndex: 1000,
              background: '#f59e0b',
              color: 'white',
              padding: '10px 14px',
              borderRadius: 8,
              textAlign: 'center',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            ⭐ Aucun favori pour l'instant. Ouvre un lieu et appuie sur l'étoile pour l'épingler.
          </div>
        )}
      </div>

      {lieuSelectionne && (
        <FicheLieu
          lieu={lieuSelectionne}
          categorie={categories.find((c) => c.id === lieuSelectionne.categorie_id)}
          onFermer={fermerLieu}
          onSignaler={soumettreSignalement}
          estFavori={favoris.includes(lieuSelectionne.id)}
          onToggleFavori={() => toggleFavori(lieuSelectionne.id)}
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
