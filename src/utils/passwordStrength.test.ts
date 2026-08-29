import { describe, it, expect } from 'vitest';
import { getPasswordStrength } from './passwordStrength';

describe('getPasswordStrength', () => {
  it('returns score 0 for an empty password', () => {
    expect(getPasswordStrength('')).toEqual({ score: 0, label: '' });
  });

  it('scores a short all-lowercase password as weak', () => {
    expect(getPasswordStrength('abcdefg').score).toBeLessThanOrEqual(1);
  });

  it('scores a long password with mixed case, numbers and symbols as strong', () => {
    expect(getPasswordStrength('Cor7ecto-Cabal!o-Baterista').score).toBe(4);
  });

  it('never exceeds the max score of 4', () => {
    expect(getPasswordStrength('Aa1!Aa1!Aa1!Aa1!Aa1!Aa1!').score).toBeLessThanOrEqual(4);
  });
});
