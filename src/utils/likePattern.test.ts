import { describe, it, expect } from 'vitest';
import { escapeLikePattern } from './likePattern';

describe('escapeLikePattern', () => {
  it('deja el texto normal intacto', () => {
    expect(escapeLikePattern('Luxioz')).toBe('Luxioz');
  });

  // El caso que importa: los nombres de usuario admiten guion bajo, y sin
  // escapar `a_b` matchearía además a `axb`.
  it('escapa el guion bajo, que es comodín de un carácter', () => {
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
  });

  it('escapa el porcentaje, que es comodín de cualquier cantidad', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
  });

  it('escapa la barra invertida antes que el resto, para no doblarla mal', () => {
    expect(escapeLikePattern('a\\_b')).toBe('a\\\\\\_b');
  });

  it('escapa todas las apariciones, no solo la primera', () => {
    expect(escapeLikePattern('a_b_c')).toBe('a\\_b\\_c');
  });
});
