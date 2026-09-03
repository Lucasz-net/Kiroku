import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchAniListUserList,
  getReclassifiedCounts,
  getStatusCounts,
  normalizeAniListUsername,
  AniListUserNotFoundError,
} from './aniListImport';

/**
 * Lo que se prueba acá es la traducción entre el modelo de AniList y el de
 * Kiroku, que es donde están todas las trampas: seis estados contra tres,
 * escalas de puntuación distintas, entradas repetidas por listas
 * personalizadas y títulos sin id de MyAnimeList.
 */

const entry = (over: Record<string, unknown> = {}) => ({
  status: 'COMPLETED',
  progress: 12,
  score: 8,
  media: {
    idMal: 1,
    title: { romaji: 'Cowboy Bebop', english: 'Cowboy Bebop' },
    episodes: 26,
    duration: 24,
    seasonYear: 1998,
    startDate: { year: 1998 },
    averageScore: 86,
    genres: ['Action'],
    // Ver el comentario de la consulta: dentro de MediaListCollection
    // AniList ignora `isMain` y hay que filtrar acá, así que el mock trae
    // también una productora que NO tiene que llegar a la fila.
    studios: { edges: [{ isMain: false, node: { name: 'Bandai Visual' } }, { isMain: true, node: { name: 'Sunrise' } }] },
    coverImage: { large: 'l.jpg', extraLarge: 'xl.jpg' },
  },
  ...over,
});

const respond = (lists: unknown[], hasNextChunk = false, status = 200) =>
  Promise.resolve(new Response(
    JSON.stringify({ data: { MediaListCollection: { hasNextChunk, lists } } }),
    { status, headers: { 'Content-Type': 'application/json' } },
  ));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('fetchAniListUserList', () => {
  it('mapea una entrada completa al modelo de Kiroku', async () => {
    fetchMock.mockReturnValue(respond([{ entries: [entry()] }]));

    const { entries } = await fetchAniListUserList('alguien');

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      malId: 1,
      title: 'Cowboy Bebop',
      status: 'Completado',
      watchedEpisodes: 12,
      userScore: 8,
      totalEpisodes: 26,
      year: 1998,
      genres: ['Action'],
      studios: ['Sunrise'],
      duration: '24 min per ep',
      // averageScore de AniList viene sobre 100.
      score: 8.6,
    });
    // A diferencia del XML de MAL, acá la portada ya viene en la respuesta.
    expect(entries[0].imageUrl).toBe('xl.jpg');
  });

  it('traduce los seis estados de AniList a los tres de Kiroku', async () => {
    const statuses = ['COMPLETED', 'CURRENT', 'REPEATING', 'PLANNING', 'PAUSED', 'DROPPED'];
    fetchMock.mockReturnValue(respond([{
      entries: statuses.map((status, i) =>
        entry({ status, media: { ...entry().media, idMal: i + 1 } })),
    }]));

    const { entries } = await fetchAniListUserList('alguien');

    expect(entries.map(e => e.status)).toEqual([
      'Completado', 'Mirando',
      // Reverla cuenta como estar mirándola.
      'Mirando',
      'Pendiente',
      // Sin equivalente en Kiroku: se avisan aparte, ver getReclassifiedCounts.
      'Pendiente', 'Pendiente',
    ]);
  });

  it('descarta y cuenta las entradas sin id de MyAnimeList', async () => {
    fetchMock.mockReturnValue(respond([{
      entries: [entry(), entry({ media: { ...entry().media, idMal: null } })],
    }]));

    const { entries, withoutMalId } = await fetchAniListUserList('alguien');

    expect(entries).toHaveLength(1);
    expect(withoutMalId).toBe(1);
  });

  it('no duplica un anime que está además en una lista personalizada', async () => {
    fetchMock.mockReturnValue(respond([
      { entries: [entry()] },
      { entries: [entry()] },
    ]));

    const { entries } = await fetchAniListUserList('alguien');

    expect(entries).toHaveLength(1);
  });

  it('trata el 0 de AniList como "sin puntuar" y no como un cero', async () => {
    fetchMock.mockReturnValue(respond([{ entries: [entry({ score: 0 })] }]));

    const { entries } = await fetchAniListUserList('alguien');

    expect(entries[0].userScore).toBe(0);
  });

  // La base tiene CHECK user_score <= 10 y progress <= 10000: un valor fuera
  // de rango haría fallar el insert de toda la tanda, no solo de esa fila.
  it('recorta puntuación y progreso a lo que acepta la base', async () => {
    fetchMock.mockReturnValue(respond([{
      entries: [entry({ score: 85, progress: 999999 })],
    }]));

    const { entries } = await fetchAniListUserList('alguien');

    expect(entries[0].userScore).toBe(10);
    expect(entries[0].watchedEpisodes).toBe(10000);
  });

  it('avisa con un error propio cuando el usuario no existe', async () => {
    fetchMock.mockReturnValue(Promise.resolve(new Response(
      JSON.stringify({ errors: [{ message: 'User not found', status: 404 }], data: { MediaListCollection: null } }),
      { status: 404 },
    )));

    await expect(fetchAniListUserList('nadie')).rejects.toBeInstanceOf(AniListUserNotFoundError);
  });

  it('devuelve vacío —sin romper— si la cuenta no tiene lista pública', async () => {
    fetchMock.mockReturnValue(Promise.resolve(new Response(
      JSON.stringify({ data: { MediaListCollection: null } }),
      { status: 200 },
    )));

    const { entries } = await fetchAniListUserList('alguien');
    expect(entries).toEqual([]);
  });

  it('sigue pidiendo tandas mientras haya hasNextChunk', async () => {
    fetchMock
      .mockReturnValueOnce(respond([{ entries: [entry()] }], true))
      .mockReturnValueOnce(respond([{ entries: [entry({ media: { ...entry().media, idMal: 2 } })] }], false));

    const { entries } = await fetchAniListUserList('alguien');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(entries.map(e => e.malId)).toEqual([1, 2]);
  }, 10000);
});

describe('resúmenes para la vista previa', () => {
  it('cuenta por estado de Kiroku', () => {
    const entries = [
      { status: 'Completado', aniListStatus: 'COMPLETED' },
      { status: 'Completado', aniListStatus: 'COMPLETED' },
      { status: 'Pendiente', aniListStatus: 'DROPPED' },
    ] as Parameters<typeof getStatusCounts>[0];

    expect(getStatusCounts(entries)).toEqual({ Completado: 2, Pendiente: 1 });
  });

  it('cuenta solo lo que cambió de estado al importarse', () => {
    const entries = [
      { status: 'Pendiente', aniListStatus: 'PLANNING' },
      { status: 'Pendiente', aniListStatus: 'DROPPED' },
      { status: 'Pendiente', aniListStatus: 'PAUSED' },
      { status: 'Pendiente', aniListStatus: 'PAUSED' },
    ] as Parameters<typeof getReclassifiedCounts>[0];

    // PLANNING sí tiene equivalente ("Pendiente"), así que no se avisa.
    expect(getReclassifiedCounts(entries)).toEqual({ DROPPED: 1, PAUSED: 2 });
  });
});

describe('normalizeAniListUsername', () => {
  it('acepta el nombre pelado', () => {
    expect(normalizeAniListUsername('  Luxioz  ')).toBe('Luxioz');
  });

  // Es lo que uno tiene en el portapapeles cuando está mirando su propia lista.
  it('extrae el usuario de una URL de perfil', () => {
    expect(normalizeAniListUsername('https://anilist.co/user/Luxioz/animelist')).toBe('Luxioz');
    expect(normalizeAniListUsername('anilist.co/user/Luxioz')).toBe('Luxioz');
  });

  it('saca el arroba si lo escribieron', () => {
    expect(normalizeAniListUsername('@Luxioz')).toBe('Luxioz');
  });
});
