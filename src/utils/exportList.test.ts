import { describe, it, expect } from 'vitest';
import { buildMalXml, buildKirokuJson, exportFilename } from './exportList';
import { parseMalXml } from './malXmlParser';
import type { SavedAnime } from '../types/profile';

const anime = (over: Partial<SavedAnime> = {}): SavedAnime => ({
  id: 'row-1',
  anime_id: 5114,
  title: 'Fullmetal Alchemist: Brotherhood',
  image_url: 'https://example.test/a.webp',
  status: 'Completado',
  episodes_total: 64,
  score: 9.1,
  user_score: 10,
  is_favorite: true,
  year: 2009,
  genres: ['Action'],
  studios: ['Bones'],
  duration: '24 min per ep',
  progress: 64,
  created_at: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('buildMalXml', () => {
  // La prueba que importa: lo que exportamos tiene que poder volver a
  // entrar por nuestro propio importador sin perder nada.
  it('produce un XML que nuestro propio parser vuelve a leer', () => {
    const xml = buildMalXml([anime(), anime({ anime_id: 1, title: 'Cowboy Bebop', status: 'Mirando', progress: 12, user_score: 9 })], 'luxioz');
    const parsed = parseMalXml(xml);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      malId: 5114,
      title: 'Fullmetal Alchemist: Brotherhood',
      totalEpisodes: 64,
      watchedEpisodes: 64,
      userScore: 10,
      status: 'Completado',
    });
    expect(parsed[1]).toMatchObject({ malId: 1, status: 'Mirando', watchedEpisodes: 12 });
  });

  it('traduce los estados al vocabulario de MyAnimeList', () => {
    const xml = buildMalXml([
      anime({ status: 'Completado' }),
      anime({ anime_id: 2, status: 'Mirando' }),
      anime({ anime_id: 3, status: 'Pendiente' }),
    ], 'luxioz');

    expect(xml).toContain('<my_status>Completed</my_status>');
    expect(xml).toContain('<my_status>Watching</my_status>');
    expect(xml).toContain('<my_status>Plan to Watch</my_status>');
  });

  // Un título con & o < rompería el XML y dejaría el archivo inservible.
  it('escapa los títulos con caracteres especiales', () => {
    const xml = buildMalXml([anime({ title: 'Fate/stay night: Heaven\'s Feel & <more>' })], 'luxioz');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;more&gt;');
    expect(parseMalXml(xml)[0].title).toBe('Fate/stay night: Heaven\'s Feel & <more>');
  });

  it('sobrevive a una lista sin progreso ni puntuación', () => {
    const xml = buildMalXml([anime({ progress: null, user_score: null, episodes_total: null })], 'luxioz');
    const [entry] = parseMalXml(xml);
    expect(entry.watchedEpisodes).toBe(0);
    expect(entry.userScore).toBe(0);
  });
});

describe('buildKirokuJson', () => {
  it('incluye lo que el XML de MAL no contempla', () => {
    const parsed = JSON.parse(buildKirokuJson([anime()], 'luxioz'));
    expect(parsed.source).toBe('kiroku');
    expect(parsed.count).toBe(1);
    expect(parsed.anime[0]).toMatchObject({
      is_favorite: true,
      genres: ['Action'],
      studios: ['Bones'],
      image_url: 'https://example.test/a.webp',
    });
  });
});

describe('exportFilename', () => {
  it('lleva el usuario y la fecha', () => {
    expect(exportFilename('luxioz', 'xml')).toMatch(/^kiroku-luxioz-\d{4}-\d{2}-\d{2}\.xml$/);
  });

  it('no queda sin nombre si el perfil todavía no tiene usuario', () => {
    expect(exportFilename('', 'json')).toMatch(/^kiroku-lista-/);
  });
});
