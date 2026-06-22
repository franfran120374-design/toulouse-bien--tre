import React, { useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  useMapEvents,
  useMap,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';

const CENTRE_TOULOUSE = [43.6047, 1.4442];

function iconPourCategorie(categorie) {
  const emoji = categorie?.icone || '📍';
  const couleur = categorie?.couleur || '#16a34a';
  return L.divIcon({
    html: `<div style="
      background:${couleur};
      width:32px;height:32px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:16px;border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    ">${emoji}</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const iconPointEnAttente = L.divIcon({
  html: `<div style="
    background:#fbbf24;width:28px;height:28px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    border:2px dashed white;box-shadow:0 1px 4px rgba(0,0,0,0.4);
  ">📍</div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function GestionnaireClics({ modeAjout, onClicCarte }) {
  useMapEvents({
    click(e) {
      if (modeAjout) onClicCarte({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// Recentre/zoome la carte sur la position utilisateur quand elle change
function RecentrerSur({ pos, rayon }) {
  const map = useMap();
  React.useEffect(() => {
    if (pos) {
      // zoom adapté au rayon : plus le rayon est grand, plus on dézoome
      const zoom = rayon >= 1000 ? 14 : rayon >= 500 ? 15 : 16;
      map.flyTo([pos.lat, pos.lng], zoom);
    }
  }, [pos, rayon, map]);
  return null;
}

function BoutonMaPosition() {
  const map = useMap();
  const [recherche, setRecherche] = useState(false);

  function localiser() {
    if (!navigator.geolocation) {
      alert('Géolocalisation non disponible sur cet appareil.');
      return;
    }
    setRecherche(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.flyTo([latitude, longitude], 15);
        setRecherche(false);
      },
      () => {
        alert("Impossible de récupérer ta position (autorisation refusée ?).");
        setRecherche(false);
      }
    );
  }

  return (
    <button
      className="btn"
      onClick={localiser}
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 1000,
        borderRadius: '50%',
        width: 48,
        height: 48,
        fontSize: 20,
      }}
      title="Centrer sur ma position"
    >
      {recherche ? '…' : '📍'}
    </button>
  );
}

export default function Carte({
  lieux,
  categories,
  modeAjout,
  pointEnAttente,
  onClicCarte,
  onClicLieu,
  posUser,
  rayon,
}) {
  const categorieParId = Object.fromEntries(categories.map((c) => [c.id, c]));

  return (
    <>
      <MapContainer
        center={CENTRE_TOULOUSE}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
      >
        {/*
          Tuiles OpenStreetMap "officielles". Gratuit, sans clé.
          À surveiller si le trafic grossit beaucoup : la politique d'usage
          d'OSM recommande de passer sur un fournisseur de tuiles dédié
          (MapTiler, Stadia Maps...) au-delà d'un usage occasionnel.
        */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <GestionnaireClics modeAjout={modeAjout} onClicCarte={onClicCarte} />
        <BoutonMaPosition />
        <RecentrerSur pos={posUser} rayon={rayon} />

        {posUser && (
          <>
            <Circle
              center={[posUser.lat, posUser.lng]}
              radius={rayon}
              pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.08 }}
            />
            <Marker
              position={[posUser.lat, posUser.lng]}
              icon={L.divIcon({
                html: `<div style="background:#2563eb;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #2563eb;"></div>`,
                className: '',
                iconSize: [18, 18],
                iconAnchor: [9, 9],
              })}
            />
          </>
        )}

        {/*
          Cluster : avec plusieurs centaines de lieux, des marqueurs proches
          se cachaient littéralement les uns les autres (les catégories
          rares comme skatepark ou parcours santé devenaient invisibles
          sous la masse de musculation/terrains de sport). Le cluster
          regroupe les marqueurs proches en un seul cercle numéroté, qui
          se "casse" en zoomant.
        */}
        <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
          {lieux.map((lieu) => (
            <Marker
              key={lieu.id}
              position={[lieu.lat, lieu.lng]}
              icon={iconPourCategorie(categorieParId[lieu.categorie_id])}
              eventHandlers={{ click: () => onClicLieu(lieu) }}
            >
              <Popup>{lieu.nom}</Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        {pointEnAttente && (
          <Marker position={[pointEnAttente.lat, pointEnAttente.lng]} icon={iconPointEnAttente} />
        )}
      </MapContainer>

      {modeAjout && !pointEnAttente && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            zIndex: 1000,
            background: '#fbbf24',
            padding: 10,
            borderRadius: 8,
            textAlign: 'center',
            fontWeight: 600,
          }}
        >
          Touche la carte à l'endroit exact du lieu à ajouter
        </div>
      )}
    </>
  );
}
