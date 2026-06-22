import React from 'react';

// Filtres qui s'appliquent EN PLUS de la sélection de catégories.
// Chacun est un interrupteur indépendant.
export default function FiltresAvances({ valeurs, onToggle }) {
  const options = [
    { cle: 'pmr', label: '♿ Accessible PMR' },
    { cle: 'ouvert', label: '🕐 Ouvert maintenant' },
    { cle: 'ombrage', label: '🌳 Ombragé' },
  ];

  return (
    <div className="filtres" style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
      {options.map((o) => (
        <button
          key={o.cle}
          className={`filtre-chip ${valeurs[o.cle] ? 'actif' : ''}`}
          onClick={() => onToggle(o.cle)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
