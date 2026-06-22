import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';

export default function AdminPanel() {
  const [session, setSession] = useState(null);
  const [estAdmin, setEstAdmin] = useState(null); // null = pas encore vérifié
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChargement(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Vérifie que le compte connecté est bien dans la table admins
  useEffect(() => {
    if (!session) {
      setEstAdmin(null);
      return;
    }
    supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setEstAdmin(!!data));
  }, [session]);

  if (chargement) return <div style={{ padding: 24 }}>Chargement…</div>;
  if (!session) return <Login />;
  if (estAdmin === false)
    return (
      <div style={{ padding: 24 }}>
        <p>Ce compte n'a pas les droits d'administration.</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>
          Se déconnecter
        </button>
      </div>
    );
  if (estAdmin === null) return <div style={{ padding: 24 }}>Vérification des droits…</div>;

  return <FileModeration />;
}

function Login() {
  const [email, setEmail] = useState('');
  const [mdp, setMdp] = useState('');
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  async function connexion(e) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: mdp });
    if (error) setErreur(error.message);
    setEnvoi(false);
  }

  return (
    <div style={{ maxWidth: 360, margin: '60px auto', padding: 24 }}>
      <h2>Administration</h2>
      <form onSubmit={connexion}>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Mot de passe</label>
          <input
            type="password"
            value={mdp}
            onChange={(e) => setMdp(e.target.value)}
            required
          />
        </div>
        {erreur && <p style={{ color: '#dc2626' }}>{erreur}</p>}
        <button className="btn" type="submit" disabled={envoi}>
          {envoi ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
      <p style={{ marginTop: 16 }}>
        <a href="#">← Retour à la carte</a>
      </p>
    </div>
  );
}

function FileModeration() {
  const [lieux, setLieux] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [signalements, setSignalements] = useState([]);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    setChargement(true);
    const [lieuxRes, photosRes, signRes] = await Promise.all([
      supabase.from('lieux').select('*').eq('statut_moderation', 'en_attente').order('created_at'),
      supabase
        .from('photos_proposees')
        .select('*, lieux(nom)')
        .eq('statut_moderation', 'en_attente')
        .order('created_at'),
      supabase.from('signalements').select('*, lieux(nom)').eq('statut', 'ouvert').order('created_at'),
    ]);
    setLieux(lieuxRes.data || []);
    setPhotos(photosRes.data || []);
    setSignalements(signRes.data || []);
    setChargement(false);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function modererLieu(id, statut) {
    await supabase.from('lieux').update({ statut_moderation: statut }).eq('id', id);
    charger();
  }

  async function modererPhoto(photo, statut) {
    await supabase.from('photos_proposees').update({ statut_moderation: statut }).eq('id', photo.id);
    // Si approuvée, on l'attache au lieu comme photo principale
    if (statut === 'approuve') {
      await supabase.from('lieux').update({ photo_url: photo.url }).eq('id', photo.lieu_id);
    }
    charger();
  }

  async function traiterSignalement(id, statut) {
    await supabase.from('signalements').update({ statut }).eq('id', id);
    charger();
  }

  if (chargement) return <div style={{ padding: 24 }}>Chargement de la file…</div>;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ marginRight: 'auto' }}>Modération</h2>
        <a className="btn" href="#" style={{ textDecoration: 'none' }}>
          Voir la carte
        </a>
        <button className="btn" onClick={() => supabase.auth.signOut()}>
          Déconnexion
        </button>
      </div>

      <h3>Lieux proposés ({lieux.length})</h3>
      {lieux.length === 0 && <p>Aucun lieu en attente.</p>}
      {lieux.map((l) => (
        <div key={l.id} style={cardStyle}>
          <strong>{l.nom}</strong>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            {l.adresse || 'sans adresse'} — {l.lat.toFixed(5)}, {l.lng.toFixed(5)}
          </div>
          {l.description && <p style={{ fontSize: 14 }}>{l.description}</p>}
          <div className="row">
            <button className="btn" onClick={() => modererLieu(l.id, 'approuve')}>
              ✓ Approuver
            </button>
            <button className="btn" style={rejStyle} onClick={() => modererLieu(l.id, 'rejete')}>
              ✕ Rejeter
            </button>
          </div>
        </div>
      ))}

      <h3>Photos proposées ({photos.length})</h3>
      {photos.length === 0 && <p>Aucune photo en attente.</p>}
      {photos.map((p) => (
        <div key={p.id} style={cardStyle}>
          <div style={{ fontSize: 13, color: '#64748b' }}>Pour : {p.lieux?.nom || p.lieu_id}</div>
          <img
            src={p.url}
            alt=""
            style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, margin: '8px 0' }}
          />
          <div className="row">
            <button className="btn" onClick={() => modererPhoto(p, 'approuve')}>
              ✓ Approuver
            </button>
            <button className="btn" style={rejStyle} onClick={() => modererPhoto(p, 'rejete')}>
              ✕ Rejeter
            </button>
          </div>
        </div>
      ))}

      <h3>Signalements ({signalements.length})</h3>
      {signalements.length === 0 && <p>Aucun signalement ouvert.</p>}
      {signalements.map((s) => (
        <div key={s.id} style={cardStyle}>
          <div>
            <strong>{s.type}</strong> — {s.lieux?.nom || s.lieu_id}
          </div>
          {s.commentaire && <p style={{ fontSize: 14 }}>{s.commentaire}</p>}
          <div className="row">
            <button className="btn" onClick={() => traiterSignalement(s.id, 'traite')}>
              Marquer traité
            </button>
            <button
              className="btn"
              style={rejStyle}
              onClick={() => traiterSignalement(s.id, 'rejete')}
            >
              Rejeter
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const cardStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: 14,
  marginBottom: 12,
};
const rejStyle = { background: '#fee2e2', color: '#991b1b' };
