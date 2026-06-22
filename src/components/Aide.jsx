import React, { useEffect, useState } from 'react';

// Pop-up d'accueil : explique l'appli, se ferme au clic ou automatiquement
// après 30 secondes. Affiche une barre de progression pour que l'utilisateur
// voie que ça va se fermer tout seul (sinon une fermeture surprise déroute).
export default function Aide({ onFermer }) {
  const DUREE = 30000; // 30 secondes
  const [reste, setReste] = useState(DUREE);

  useEffect(() => {
    const debut = Date.now();
    const tick = setInterval(() => {
      const ecoule = Date.now() - debut;
      if (ecoule >= DUREE) {
        clearInterval(tick);
        onFermer();
      } else {
        setReste(DUREE - ecoule);
      }
    }, 100);
    return () => clearInterval(tick);
  }, [onFermer]);

  const pourcent = (reste / DUREE) * 100;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onFermer}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          maxWidth: 460,
          width: '100%',
          padding: 24,
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onFermer}
          style={{
            position: 'absolute',
            top: 12,
            right: 16,
            border: 'none',
            background: 'none',
            fontSize: 22,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>

        <h2 style={{ marginTop: 0 }}>🌿 Bienvenue sur Toulouse Bien-être</h2>
        <p>
          Cette carte recense les lieux et activités <strong>gratuits</strong> de la
          métropole toulousaine : musculation en plein air, ping-pong, jeux pour enfants,
          fontaines à boire, parcs, skateparks, et bien plus.
        </p>
        <p style={{ margin: '12px 0 4px', fontWeight: 600 }}>Comment l'utiliser :</p>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
          <li>Choisis une ou plusieurs <strong>catégories</strong> en haut pour afficher les lieux.</li>
          <li>Touche un point pour voir ses <strong>détails</strong>, son itinéraire et les avis.</li>
          <li>Tu connais un lieu manquant ? Utilise <strong>« + Ajouter un lieu »</strong>.</li>
          <li>Tu peux aussi proposer une <strong>photo</strong> ou un <strong>avis</strong> sur chaque fiche.</li>
        </ul>

        <button
          className="btn"
          style={{ marginTop: 20, width: '100%', background: '#16a34a', color: 'white' }}
          onClick={onFermer}
        >
          C'est parti !
        </button>

        {/* Barre de progression de la fermeture auto */}
        <div style={{ marginTop: 14, height: 4, background: '#e2e8f0', borderRadius: 2 }}>
          <div
            style={{
              height: '100%',
              width: `${pourcent}%`,
              background: '#16a34a',
              borderRadius: 2,
              transition: 'width 0.1s linear',
            }}
          />
        </div>
      </div>
    </div>
  );
}
