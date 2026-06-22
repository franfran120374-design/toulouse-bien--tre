import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const TYPES_SIGNALEMENT = [
  { value: 'disparu', label: 'Le lieu a disparu' },
  { value: 'deplace', label: "Il a été déplacé" },
  { value: 'degrade', label: "L'équipement est cassé / dégradé" },
  { value: 'horaires_incorrects', label: 'Les horaires sont faux' },
  { value: 'autre', label: 'Autre' },
];

// Redimensionne et recompresse une image dans le navigateur avant l'upload.
// On accepte n'importe quelle taille de photo (même 48 Mpx d'un téléphone
// récent) et on la ramène à une largeur max nette pour un écran, ce qui
// fait tomber le poids à quelques centaines de Ko sans perte visible.
async function compresserImage(fichier, largeurMax = 1600, qualite = 0.82) {
  // Les images déjà petites ne gagnent rien à être retraitées
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(fichier);
  });

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  // Si l'image est déjà plus étroite que la cible, on garde ses dimensions
  const ratio = Math.min(1, largeurMax / img.width);
  const largeur = Math.round(img.width * ratio);
  const hauteur = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = largeur;
  canvas.height = hauteur;
  canvas.getContext('2d').drawImage(img, 0, 0, largeur, hauteur);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', qualite)
  );
  return blob; // toujours du JPEG en sortie
}

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
    if (!fichier.type.startsWith('image/')) {
      setPhotoErreur('Le fichier doit être une image.');
      return;
    }
    setPhotoEnvoi(true);
    setPhotoErreur(null);
    try {
      // Compression côté navigateur : on accepte toute taille en entrée,
      // l'image sort en JPEG léger (~quelques centaines de Ko).
      let aEnvoyer;
      try {
        aEnvoyer = await compresserImage(fichier);
      } catch {
        // Si la compression échoue (format exotique type HEIC non décodable
        // par le navigateur), on retombe sur le fichier d'origine.
        aEnvoyer = fichier;
      }

      const chemin = `proposees/${lieu.id}/${Date.now()}.jpg`;
      const { error: errUp } = await supabase.storage
        .from('photos-lieux')
        .upload(chemin, aEnvoyer, { upsert: false, contentType: 'image/jpeg' });
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
          {lieu.commune && lieu.commune !== 'Toulouse' ? `, ${lieu.commune}` : ''}
        </p>
      )}
      {lieu.horaires ? (
        <p>
          <strong>Horaires :</strong> {lieu.horaires}
        </p>
      ) : (
        <p style={{ color: '#16a34a' }}>
          <strong>Accès :</strong> libre, sans horaires connus
        </p>
      )}

      {lieu.details && (
        <div style={{ margin: '8px 0' }}>
          {Object.entries(lieu.details).map(([cle, valeur]) => (
            <div key={cle} style={{ fontSize: 14, padding: '2px 0' }}>
              <strong>{cle} :</strong>{' '}
              {String(valeur).startsWith('http') ? (
                <a href={valeur} target="_blank" rel="noreferrer">
                  lien
                </a>
              ) : (
                valeur
              )}
            </div>
          ))}
        </div>
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
