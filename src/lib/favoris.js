// Gestion des favoris stockés sur l'appareil du visiteur (localStorage).
// Pas de compte requis : simple et sans friction. Limite assumée : les
// favoris ne suivent pas si la personne change d'appareil ou vide son
// navigateur.
//
// Note : localStorage ne fonctionne pas dans l'aperçu d'artifact de Claude,
// mais marche normalement sur le site déployé et en local.

const CLE = 'favoris_lieux';

export function lireFavoris() {
  try {
    const brut = localStorage.getItem(CLE);
    return brut ? JSON.parse(brut) : [];
  } catch {
    return [];
  }
}

export function estFavori(id) {
  return lireFavoris().includes(id);
}

export function basculerFavori(id) {
  const actuels = lireFavoris();
  const suivant = actuels.includes(id)
    ? actuels.filter((x) => x !== id)
    : [...actuels, id];
  try {
    localStorage.setItem(CLE, JSON.stringify(suivant));
  } catch {
    // stockage indisponible (mode privé strict, quota) : on ignore
  }
  return suivant;
}
