// --- NUEVA INTERFAZ DE GÉNERO ---
export interface Genre {
  mal_id: number;
  name: string;
  type?: string;
  url?: string;
}

// 1. Estructura base de un Anime
export interface Anime {
  mal_id: number;
  title: string;
  title_english?: string | null;
  type?: string;
  episodes: number | null;
  score?: number | null;
  synopsis?: string | null;
  duration?: string;
  rank?: number | null;
  popularity?: number | null;
  images: {
    jpg: {
      image_url: string;
      large_image_url: string;
    };
    webp?: {
      image_url: string;
      large_image_url: string;
    };
  };
  aired?: {
    from: string;
  };
  genres?: Genre[]; 
}

// 2. Respuesta de búsqueda general
export interface JikanResponse {
  data: Anime[];
  pagination?: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
  };
}

// 3. Estructura de un Personaje
export interface Character {
  character: {
    mal_id: number;
    name: string;
    images: {
      jpg: {
        image_url: string;
        large_image_url: string;
      };
      webp?: {
        image_url: string;
        large_image_url: string;
      };
    };
  };
  role: string;
  favorites?: number;
}

// Detalle ampliado de un personaje (panel), tal como lo devuelve la API
// oficial de MAL. No repite nombre/imagen: el panel ya los tiene de la
// tarjeta que lo abrió, así que se renderiza completo desde el primer frame
// y solo estos campos llegan después.
//
// No incluye actor de voz porque MAL no lo expone; si algún día vuelve a
// haber una fuente para ese dato, se agrega acá.
export interface CharacterDetail {
  description: string | null;
  nicknames: string[];
  favorites: number | null;
  /** Galería de ilustraciones alternativas, sin incluir el retrato principal. */
  pictures: string[];
}

// 4. Estructura extendida para el "Nodo de Datos" (Detalles completos)
export interface AnimeFull extends Anime {
  synopsis: string;
  year: number | null;
  status: string;
  studios: { mal_id: number; name: string }[];
  genres: Genre[]; 
  score: number | null;
  trailer?: {
    youtube_id: string | null;
    url: string | null;
    embed_url: string | null; 
  };
  relations?: AnimeRelation[];
}

// 6. Respuesta de los detalles completos
export interface JikanFullResponse {
  data: AnimeFull;
}

export interface AnimeRelationEntry {
  mal_id: number;
  type: string; 
  name: string;
}

export interface AnimeRelation {
  relation: string; 
  entry: AnimeRelationEntry[];
}