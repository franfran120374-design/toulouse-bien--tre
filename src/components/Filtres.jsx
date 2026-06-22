import React from 'react';

export default function Filtres({ categories, categoriesActives, onToggle }) {
  if (!categories.length) return null;

  return (
    <div className="filtres">
      {categories.map((cat) => {
        const actif = categoriesActives.includes(cat.id);
        return (
          <button
            key={cat.id}
            className={`filtre-chip ${actif ? 'actif' : ''}`}
            onClick={() => onToggle(cat.id)}
            title={cat.nom}
          >
            <span>{cat.icone}</span>
            <span>{cat.nom}</span>
          </button>
        );
      })}
    </div>
  );
}
