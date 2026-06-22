import React, { useState, useEffect } from 'react';
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

export default function FicheLieu({ lieu, categorie, onFermer, onSignaler, estFavori, onToggleFavori }) {
  const [signalementOuvert, setSignalementOuvert] = useState(false);
  const [type, setType] = useState(TYPES_SIGNALEMENT[0].value);
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  const [photoEnvoi, setPhotoEnvoi] = useState(false);
  const [photoEnvoyee, setPhotoEnvoyee] = useState(false);
  const [photoErreur, setPhotoErreur] = useState(null);

  // --- Commentaires / avis ---
  const [avis, setAvis] = useState([]);
  const [avisTexte, setAvisTexte] = useState('');
  const [avisAuteur, setAvisAuteur] = useState('');
  const [avisNote, setAvisNote] = useState(0); // 0 = pas de note
  const [avisEnvoi, setAvisEnvoi] = useState(false);
  const [avisEnvoye, setAvisEnvoye] = useState(false);
  const [avisErreur, setAvisErreur] = useState(null);
  const [lienCopie, setLienCopie] = useState(false);

  async function partager() {
    const url = `${window.location.origin}/lieu/${lieu.id}`;
    // Sur mobile, ouvre le menu de partage natif ; sinon copie le lien
    if (navigator.share) {
      try {
        await navigator.share({ title: lieu.nom, text: `${lieu.nom} sur Toulouse Bien-être`, url });
        return;
      } catch {
        // l'utilisateur a annulé le partage : on ne fait rien
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setLienCopie(true);
      setTimeout(() => setLienCopie(false), 2000);
    } catch {
      // clipboard indisponible (vieux navigateur) : on affiche le lien à copier
      window.prompt('Copie ce lien :', url);
    }
  }

  useEffect(() => {
    let actif = true;
    supabase
      .from('commentaires')
      .select('*')
      .eq('lieu_id', lieu.id)
      .eq('statut_moderation', 'approuve')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (actif) setAvis(data || []);
      });
    return () => {
      actif = false;
    };
  }, [lieu.id]);

  async function envoyerAvis(e) {
    e.preventDefault();
    if (!avisTexte.trim()) {
      setAvisErreur('Écris un commentaire.');
      return;
    }
    setAvisEnvoi(true);
    setAvisErreur(null);
    try {
      const { error } = await supabase.from('commentaires').insert({
        lieu_id: lieu.id,
        texte: avisTexte.trim(),
        auteur: avisAuteur.trim() || null,
        note: avisNote > 0 ? avisNote : null,
      });
      if (error) throw error;
      setAvisEnvoye(true);
    } catch (err) {
      setAvisErreur(err.message);
    } finally {
      setAvisEnvoi(false);
    }
  }

  const lienItineraire = `https://www.google.com/maps/dir/?api=1&destination=${lieu.lat},${lieu.lng}`;
  // Recherche Google Maps par nom + position : ouvre la fiche Google du lieu
  // (l'utilisateur y consulte les avis directement chez Google).
  const lienGoogleMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    lieu.nom
  )}&query_place_id=&center=${lieu.lat},${lieu.lng}`;
  // Site web éventuel : stocké soit dans une colonne dédiée, soit dans details
  const siteWeb =
    lieu.site_web ||
    lieu.details?.Site ||
    lieu.details?.['Site web'] ||
    null;

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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <h2 style={{ flex: 1, margin: '8px 0' }}>{lieu.nom}</h2>
        {onToggleFavori && (
          <button
            onClick={onToggleFavori}
            title={estFavori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 28,
              lineHeight: 1,
              color: estFavori ? '#f59e0b' : '#cbd5e1',
            }}
          >
            ★
          </button>
        )}
      </div>

      {lieu.photo_url && (
        <img
          src={lieu.photo_url}
          alt={lieu.nom}
          style={{
            width: '100%',
            maxHeight: 320,
            objectFit: 'contain',
            borderRadius: 10,
            margin: '8px 0',
            background: '#f1f5f9',
          }}
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
          {Object.entries(lieu.details)
            .filter(([cle, valeur]) => !String(valeur).startsWith('http') && cle !== 'Site' && cle !== 'Site web')
            .map(([cle, valeur]) => (
              <div key={cle} style={{ fontSize: 14, padding: '2px 0' }}>
                <strong>{cle} :</strong> {valeur}
              </div>
            ))}
        </div>
      )}

      {lieu.accessible_pmr && <span className="badge">♿ Accessible PMR</span>}

      <div className="row" style={{ marginTop: 16 }}>
        <a className="btn" href={lienItineraire} target="_blank" rel="noreferrer" style={{ textAlign: 'center', textDecoration: 'none' }}>
          🧭 Y aller
        </a>
        <button className="btn" onClick={partager}>
          {lienCopie ? '✓ Lien copié' : '🔗 Partager'}
        </button>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <a
          className="btn"
          href={lienGoogleMaps}
          target="_blank"
          rel="noreferrer"
          style={{ textAlign: 'center', textDecoration: 'none' }}
        >
          🔎 Voir sur Google Maps
        </a>
        {siteWeb && (
          <a
            className="btn"
            href={siteWeb.startsWith('http') ? siteWeb : `https://${siteWeb}`}
            target="_blank"
            rel="noreferrer"
            style={{ textAlign: 'center', textDecoration: 'none' }}
          >
            🌐 Site web
          </a>
        )}
      </div>

      <div className="row" style={{ marginTop: 8 }}>
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

      <div style={{ marginTop: 20, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
        <h3 style={{ margin: '0 0 8px' }}>
          Avis {avis.length > 0 && `(${avis.length})`}
        </h3>

        {avis.length === 0 && (
          <p style={{ color: '#64748b', fontSize: 14 }}>
            Aucun avis pour l'instant. Sois le premier à en laisser un !
          </p>
        )}

        {avis.map((a) => (
          <div
            key={a.id}
            style={{ borderBottom: '1px solid #f1f5f9', padding: '8px 0', fontSize: 14 }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {a.note && <span>{'★'.repeat(a.note)}{'☆'.repeat(5 - a.note)}</span>}
              <strong>{a.auteur || 'Anonyme'}</strong>
            </div>
            <p style={{ margin: '4px 0 0' }}>{a.texte}</p>
          </div>
        ))}

        {!avisEnvoye ? (
          <form onSubmit={envoyerAvis} style={{ marginTop: 12 }}>
            <div className="field">
              <label>Ton avis</label>
              <textarea
                rows={3}
                maxLength={1000}
                value={avisTexte}
                onChange={(e) => setAvisTexte(e.target.value)}
                placeholder="Ton retour sur ce lieu…"
              />
            </div>
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label>Prénom (optionnel)</label>
                <input value={avisAuteur} onChange={(e) => setAvisAuteur(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Note (optionnel)</label>
                <div style={{ fontSize: 24, cursor: 'pointer', userSelect: 'none' }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      onClick={() => setAvisNote(n === avisNote ? 0 : n)}
                      style={{ color: n <= avisNote ? '#f59e0b' : '#cbd5e1' }}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {avisErreur && <p style={{ color: '#dc2626' }}>{avisErreur}</p>}
            <button className="btn" type="submit" disabled={avisEnvoi}>
              {avisEnvoi ? 'Envoi…' : 'Publier mon avis'}
            </button>
          </form>
        ) : (
          <div className="confirmation" style={{ marginTop: 12 }}>
            Merci ! Ton avis sera vérifié avant d'apparaître.
          </div>
        )}
      </div>
    </div>
  );
}
