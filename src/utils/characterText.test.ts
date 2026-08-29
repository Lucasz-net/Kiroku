import { describe, it, expect } from 'vitest';
import { cleanCharacterBio } from './characterText';

describe('cleanCharacterBio', () => {
  it('returns null for empty or missing input', () => {
    expect(cleanCharacterBio(null)).toBeNull();
    expect(cleanCharacterBio(undefined)).toBeNull();
    expect(cleanCharacterBio('   ')).toBeNull();
  });

  it('converts <br /> into line breaks and drops other tags', () => {
    expect(cleanCharacterBio('Edad: 17<br />\r\nTipo: A<i>x</i>')).toBe('Edad: 17\nTipo: Ax');
  });

  it('decodes the HTML entities MAL and Jikan leave in the text', () => {
    expect(cleanCharacterBio('Se hace llamar &quot;Zero&quot; y no es Lelouch&#039;s amigo'))
      .toBe('Se hace llamar "Zero" y no es Lelouch\'s amigo');
  });

  // El motivo original de este util: los enlaces crudos se veían tal cual
  // dentro del panel de personaje.
  it('strips bare URLs', () => {
    expect(cleanCharacterBio('Himmel el heroe. https://anilist.co/character/184311/Himmel'))
      .toBe('Himmel el heroe.');
  });

  it('strips source credits and spoiler markers', () => {
    expect(cleanCharacterBio('Un mago. (Source: Wikipedia)')).toBe('Un mago.');
    expect(cleanCharacterBio('[spoiler]Muere[/spoiler]')).toBe('Muere');
  });

  // Visto en la biografía real de Levi, que llegaba con "[b]Nota[/b]".
  it('strips the rest of the BBCode MAL stores raw', () => {
    expect(cleanCharacterBio('[b]Nota[/b]: Levi es la traducción oficial.'))
      .toBe('Nota: Levi es la traducción oficial.');
    expect(cleanCharacterBio('[i]cursiva[/i] y [url=http://x.com]enlace[/url]'))
      .toBe('cursiva y enlace');
  });

  it('leaves ordinary square brackets alone', () => {
    expect(cleanCharacterBio('Conocido como [el soldado más fuerte]'))
      .toBe('Conocido como [el soldado más fuerte]');
  });

  it('collapses the blank lines left behind by the removals', () => {
    expect(cleanCharacterBio('Uno\n\n\n\nDos')).toBe('Uno\n\nDos');
  });

  it('returns null when nothing survives the cleanup', () => {
    expect(cleanCharacterBio('https://example.com')).toBeNull();
  });
});
