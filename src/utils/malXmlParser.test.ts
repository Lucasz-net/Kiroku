import { describe, it, expect } from 'vitest';
import { parseMalXml, getMalStatusCounts, getReclassifiedCounts } from './malXmlParser';

const xml = (...entries: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<myanimelist>
  <myinfo><user_name>lucas</user_name></myinfo>
  ${entries.join('\n')}
</myanimelist>`;

const anime = (id: number, status: string, title = `Anime ${id}`) => `
  <anime>
    <series_animedb_id>${id}</series_animedb_id>
    <series_title>${title}</series_title>
    <series_episodes>12</series_episodes>
    <my_watched_episodes>5</my_watched_episodes>
    <my_score>8</my_score>
    <my_status>${status}</my_status>
  </anime>`;

describe('parseMalXml', () => {
  it('maps the two statuses Kiroku actually has', () => {
    const entries = parseMalXml(xml(anime(1, 'Completed'), anime(2, 'Watching')));
    expect(entries.map(e => e.status)).toEqual(['Completado', 'Mirando']);
  });

  it('keeps the original MAL status alongside the mapped one', () => {
    const [entry] = parseMalXml(xml(anime(1, 'Dropped')));
    expect(entry.malStatus).toBe('Dropped');
    expect(entry.status).toBe('Pendiente');
  });

  it('skips entries without a usable id instead of importing garbage', () => {
    const broken = '<anime><series_animedb_id></series_animedb_id><my_status>Completed</my_status></anime>';
    expect(parseMalXml(xml(broken, anime(7, 'Completed')))).toHaveLength(1);
  });
});

// Kiroku tiene tres estados y MAL cinco, así que "Dropped" y "On-Hold" entran
// como "Pendiente". Se sigue importando, pero hay que poder avisarlo antes en
// vez de cambiarle la lista al usuario por atrás.
describe('getReclassifiedCounts', () => {
  it('counts only the statuses that lose meaning on import', () => {
    const entries = parseMalXml(xml(
      anime(1, 'Completed'),
      anime(2, 'Watching'),
      anime(3, 'Plan to Watch'),
      anime(4, 'Dropped'),
      anime(5, 'Dropped'),
      anime(6, 'On-Hold'),
    ));

    expect(getReclassifiedCounts(entries)).toEqual({ 'Dropped': 2, 'On-Hold': 1 });
  });

  it('accepts the "On Hold" spelling too', () => {
    expect(getReclassifiedCounts(parseMalXml(xml(anime(1, 'On Hold'))))).toEqual({ 'On Hold': 1 });
  });

  it('returns nothing when every status maps cleanly', () => {
    const entries = parseMalXml(xml(anime(1, 'Completed'), anime(2, 'Watching')));
    expect(getReclassifiedCounts(entries)).toEqual({});
  });

  it('does not distort the plain status counts', () => {
    const entries = parseMalXml(xml(anime(1, 'Completed'), anime(2, 'Dropped')));
    expect(getMalStatusCounts(entries)).toEqual({ 'Completado': 1, 'Pendiente': 1 });
  });
});
