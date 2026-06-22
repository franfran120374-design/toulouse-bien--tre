import React, { useState } from 'react';

export default function FormulaireAjout({ categories, point, onAnnuler, onSoumettre }) {
  const [nom, setNom] = useState('');
  const [categorieId, setCategorieId] = useState(categories[0]?.id || '');
  const [description, setDescription] = useState('');
  const [adresse, setAdresse] = useState('');
  const [horaires, setHoraires] = useState('');
  const [accessiblePmr, setAccessiblePmr] = useState(false);
  const [email, setEmail] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nom.trim() || !categorieId) {
      setErreur('Le nom et la catégorie sont obligatoires.');
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      await onSoumettre({
        nom: nom.trim(),
        categorie_id: categorieId,
        description: description.trim() || null,
        adresse: adresse.trim() || null,
        horaires: horaires.trim() || null,
        accessible_pmr: accessiblePmr,
        contributeur_email: email.trim() || null,
      });
      setEnvoye(true);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (envoye) {
    return (
      <div className="panel">
        <button className="panel-close" onClick={onAnnuler}>
          ✕
        </button>
        <div className="confirmation">
          Merci ! Ton ajout est enregistré et sera vérifié avant d'apparaître sur la carte.
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <button className="panel-close" onClick={onAnnuler}>
        ✕
      </button>
      <h2>Ajouter un lieu</h2>
      <p style={{ fontSize: 13, color: '#64748b' }}>
        Position choisie : {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
      </p>

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Nom du lieu *</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} required />
        </div>

        <div className="field">
          <label>Catégorie *</label>
          <select value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icone} {c.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Description</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="field">
          <label>Adresse approximative</label>
          <input value={adresse} onChange={(e) => setAdresse(e.target.value)} />
        </div>

        <div className="field">
          <label>Horaires d'accès (si limités)</label>
          <input
            placeholder="Ex : 8h-20h en été, 8h-18h en hiver"
            value={horaires}
            onChange={(e) => setHoraires(e.target.value)}
          />
        </div>

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={accessiblePmr}
              onChange={(e) => setAccessiblePmr(e.target.checked)}
              style={{ width: 'auto', marginRight: 6 }}
            />
            Accessible aux personnes à mobilité réduite
          </label>
        </div>

        <div className="field">
          <label>Ton email (optionnel, pour te recontacter si besoin)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        {erreur && <p style={{ color: '#dc2626' }}>{erreur}</p>}

        <button className="btn" type="submit" disabled={envoi}>
          {envoi ? 'Envoi…' : 'Proposer ce lieu'}
        </button>
      </form>
    </div>
  );
}
