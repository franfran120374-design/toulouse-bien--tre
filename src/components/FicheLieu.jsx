import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const TYPES_SIGNALEMENT = [
  { value: 'disparu', label: 'Le lieu a disparu' },
  { value: 'deplace', label: "Il a été déplacé" },
  { value: 'degrade', label: "L'équipement est cassé / dégradé" },
  { value: 'horaires_incorrects', label: 'Les horaires sont faux' },
  { value: 'autre', label: 'Autre' },
];

export default function FicheLieu({ lieu, categorie, onFermer, onSignaler }) {
  const [signalementOuvert, setSignalementOuvert] = useState(false);
  const [type, setType] = useState(TYPES_SIGNALEMENT[0].value);
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  const [photoEnvoi, setPhotoEnvoi] = useState(false);
  const [photoEnvoyee, setPhotoEnvoyee] = useState(false);
  const [photoErreur, setPhotoErreur] = useState(null);

  const lienItineraire = `https://www.google.com/maps/dir/?api=1&destination=${lieu.lat},${lieu.lng}`;

  async function proposerPhoto(e) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    // Garde-fous simples côté client (la vraie validation reste la modération)
    if (!fichier.type.startsWith('image/')) {
      setPhotoErreur('Le fichier doit être une image.');
      return;
    }
    if (fichier.size > 5 * 1024 * 1024) {
      setPhotoErreur('Image trop lourde (max 5 Mo).');
      return;
    }
    setPhotoEnvoi(true);
    setPhotoErreur(null);
    try {
      const ext = fichier.name.split('.').pop();
      const chemin = `proposees/${lieu.id}/${Date.now()}.${ext}`;
      const { error: errUp } = await supabase.storage
        .from('photos-lieux')
        .upload(chemin, fichier, { upsert: false });
      if (errUp) throw errUp;

      const { data: pub } = supabase.storage.from('photos-lieux').getPublicUrl(chemin);
      const { error: errIns } = await supabase
        .from('photos_proposees')
        .insert({ lieu_id: lieu.id, url: pub.publicUrl });
      if (errIns) throw errIns;

      setPhotoEnvoyee(true);
    } catch (err) {
      setPhotoErreur(err.message);
    } finally {
      setPhotoEnvoi(false);
    }
  }

  async function envoyerSignalement(e) {
    e.preventDefault();
    setEnvoi(true);
    try {
      await onSignaler(lieu.id, { type, commentaire });
      setEnvoye(true);
    } catch (err) {
      alert("Erreur lors de l'envoi du signalement : " + err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="panel">
      <button className="panel-close" onClick={onFermer}>
        ✕
      </button>

      <span className="badge">
        {categorie?.icone} {categorie?.nom}
      </span>
      <h2>{lieu.nom}</h2>

      {lieu.photo_url && (
        <img
          src={lieu.photo_url}
          alt={lieu.nom}
          style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10, margin: '8px 0' }}
        />
      )}

      {lieu.description && <p>{lieu.description}</p>}
      {lieu.adresse && (
        <p>
          <strong>Adresse :</strong> {lieu.adresse}
        </p>
      )}
      {lieu.horaires && (
        <p>
          <strong>Horaires :</strong> {lieu.horaires}
        </p>
      )}
      {lieu.accessible_pmr && <span className="badge">♿ Accessible PMR</span>}

      <div className="row" style={{ marginTop: 16 }}>
        <a className="btn" href={lienItineraire} target="_blank" rel="noreferrer" style={{ textAlign: 'center', textDecoration: 'none' }}>
          🧭 Y aller
        </a>
        {!signalementOuvert && (
          <button className="btn" onClick={() => setSignalementOuvert(true)}>
            ⚠️ Signaler un problème
          </button>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        {!photoEnvoyee ? (
          <label className="btn" style={{ display: 'inline-block', cursor: 'pointer' }}>
            {photoEnvoi ? 'Envoi de la photo…' : (lieu.photo_url ? '📷 Proposer une autre photo' : '📷 Proposer une photo')}
            <input
              type="file"
              accept="image/*"
              onChange={proposerPhoto}
              disabled={photoEnvoi}
              style={{ display: 'none' }}
            />
          </label>
        ) : (
          <div className="confirmation">Merci ! La photo sera vérifiée avant d'apparaître.</div>
        )}
        {photoErreur && <p style={{ color: '#dc2626' }}>{photoErreur}</p>}
      </div>

      {signalementOuvert && !envoye && (
        <form onSubmit={envoyerSignalement} style={{ marginTop: 16 }}>
          <div className="field">
            <label>Que se passe-t-il ?</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES_SIGNALEMENT.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Précisions (optionnel)</label>
            <textarea
              rows={3}
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
            />
          </div>
          <button className="btn" type="submit" disabled={envoi}>
            {envoi ? 'Envoi…' : 'Envoyer le signalement'}
          </button>
        </form>
      )}

      {envoye && (
        <div className="confirmation" style={{ marginTop: 16 }}>
          Merci, ton signalement a été enregistré et sera vérifié.
        </div>
      )}
    </div>
  );
}
