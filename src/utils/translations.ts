// Display-only translations for the fixed, finite vocabularies AniList/Jikan
// return in English (genres, relation types, character roles, airing status,
// media format). These never touch the underlying values used for business
// logic (status comparisons, genre-name search filters, etc.) — only what's
// rendered to the user.

const GENRES_ES: Record<string, string> = {
  Action: 'Acción',
  Adventure: 'Aventura',
  'Avant Garde': 'Vanguardista',
  'Award Winning': 'Premiada',
  'Boys Love': 'Yaoi (BL)',
  Comedy: 'Comedia',
  Drama: 'Drama',
  Ecchi: 'Ecchi',
  Erotica: 'Erótico',
  Fantasy: 'Fantasía',
  'Girls Love': 'Yuri (GL)',
  Gourmet: 'Gastronómico',
  Hentai: 'Hentai',
  Horror: 'Terror',
  'Mahou Shoujo': 'Mahou Shoujo',
  Mecha: 'Mecha',
  Music: 'Música',
  Mystery: 'Misterio',
  Psychological: 'Psicológico',
  Romance: 'Romance',
  'Sci-Fi': 'Ciencia Ficción',
  'Slice of Life': 'Recuentos de la Vida',
  Sports: 'Deportes',
  Supernatural: 'Sobrenatural',
  Suspense: 'Suspenso',
  Thriller: 'Suspenso',
  'Adult Cast': 'Reparto Adulto',
  Anthropomorphic: 'Antropomórfico',
  CGDCT: 'Chicas Lindas Haciendo Cosas Lindas',
  Childcare: 'Crianza',
  'Combat Sports': 'Deportes de Combate',
  Crossdressing: 'Travestismo',
  Delinquents: 'Delincuentes',
  Detective: 'Detectives',
  Educational: 'Educativo',
  'Gag Humor': 'Humor Absurdo',
  Gore: 'Gore',
  Harem: 'Harem',
  'High Stakes Game': 'Juegos de Alto Riesgo',
  Historical: 'Histórico',
  'Idols (Female)': 'Ídolos (Femenino)',
  'Idols (Male)': 'Ídolos (Masculino)',
  Isekai: 'Isekai',
  Iyashikei: 'Iyashikei',
  'Love Polygon': 'Polígono Amoroso',
  'Magical Sex Shift': 'Cambio de Sexo Mágico',
  'Martial Arts': 'Artes Marciales',
  Medical: 'Médico',
  Military: 'Militar',
  Mythology: 'Mitología',
  'Organized Crime': 'Crimen Organizado',
  'Otaku Culture': 'Cultura Otaku',
  Parody: 'Parodia',
  'Performing Arts': 'Artes Escénicas',
  Pets: 'Mascotas',
  Racing: 'Carreras',
  Reincarnation: 'Reencarnación',
  'Reverse Harem': 'Harem Inverso',
  'Love Status Quo': 'Status Quo Amoroso',
  Samurai: 'Samurái',
  School: 'Escolar',
  Showbiz: 'Mundo del Espectáculo',
  Space: 'Espacio',
  'Strategy Game': 'Juego de Estrategia',
  'Super Power': 'Superpoderes',
  Survival: 'Supervivencia',
  'Team Sports': 'Deportes de Equipo',
  'Time Travel': 'Viaje en el Tiempo',
  Vampire: 'Vampiros',
  'Video Game': 'Videojuegos',
  'Visual Arts': 'Artes Visuales',
  Workplace: 'Ambiente Laboral',
  'Urban Fantasy': 'Fantasía Urbana',
  Villainess: 'Villana',
  Josei: 'Josei',
  Kids: 'Infantil',
  Seinen: 'Seinen',
  Shoujo: 'Shoujo',
  Shounen: 'Shounen',
};

const RELATIONS_ES: Record<string, string> = {
  sequel: 'Secuela',
  prequel: 'Precuela',
  'side story': 'Historia Secundaria',
  parent: 'Historia Principal',
  'parent story': 'Historia Principal',
  'full story': 'Historia Completa',
  summary: 'Resumen',
  alternative: 'Versión Alternativa',
  'alternative version': 'Versión Alternativa',
  'alternative setting': 'Ambientación Alternativa',
  'spin off': 'Spin-off',
  adaptation: 'Adaptación',
  character: 'Personaje',
  other: 'Otro',
  compilation: 'Compilación',
  contains: 'Contiene',
  source: 'Origen',
  'same universe': 'Mismo Universo',
};

const ROLES_ES: Record<string, string> = {
  Main: 'Principal',
  Supporting: 'Secundario',
  Background: 'De Fondo',
};

const STATUS_ES: Record<string, string> = {
  'Currently Airing': 'En Emisión',
  'Finished Airing': 'Finalizado',
  'Not yet aired': 'Próximamente',
};

const FORMAT_ES: Record<string, string> = {
  TV: 'TV',
  'TV Short': 'TV Corto',
  Movie: 'Película',
  OVA: 'OVA',
  ONA: 'ONA',
  Special: 'Especial',
  Music: 'Música',
};

const normalize = (s: string) => s.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

export const translateGenre = (name: string): string => GENRES_ES[name] ?? name;

export const translateRelation = (relation: string): string => {
  const match = RELATIONS_ES[normalize(relation)];
  return match ?? relation;
};

export const translateRole = (role: string): string => ROLES_ES[role] ?? role;

export const translateStatus = (status: string): string => STATUS_ES[status] ?? status;

export const translateFormat = (format: string): string => FORMAT_ES[format] ?? format;

const ENTRY_TYPE_ES: Record<string, string> = {
  anime: 'Anime',
  manga: 'Manga',
  novel: 'Novela',
  'light novel': 'Novela Ligera',
  'visual novel': 'Novela Visual',
  game: 'Videojuego',
  music: 'Música',
  manhwa: 'Manhwa',
  manhua: 'Manhua',
  'one-shot': 'One-shot',
  doujinshi: 'Doujinshi',
  other: 'Otro',
};

export const translateEntryType = (type: string): string => ENTRY_TYPE_ES[normalize(type)] ?? type;
