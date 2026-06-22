import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Erreur volontairement bruyante : mieux vaut planter tout de suite
  // que de se demander pendant 1h pourquoi la carte reste vide.
  console.error(
    "Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes. " +
      "Copie .env.example en .env.local et remplis-le avec les valeurs de ton projet Supabase " +
      "(Project Settings > API)."
  );
}

// Cette clé "anon" est faite pour être publique : c'est Row Level Security
// (les policies définies dans supabase_schema.sql) qui protège les données,
// pas le secret de la clé. Ne JAMAIS mettre la clé "service_role" ici.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
