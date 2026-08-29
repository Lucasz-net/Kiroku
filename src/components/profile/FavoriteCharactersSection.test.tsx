import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FavoriteCharactersSection } from './FavoriteCharactersSection';
import type { FavoriteCharacter } from '../../types/profile';

const makeCharacters = (n: number): FavoriteCharacter[] =>
  Array.from({ length: n }, (_, i) => ({
    character_id: i + 1,
    name: `Personaje ${i + 1}`,
    image_url: `https://example.com/${i + 1}.jpg`,
    anime_id: 100 + i,
    anime_title: `Anime ${i + 1}`,
  }));

const renderSection = (characters: FavoriteCharacter[]) =>
  render(
    <MemoryRouter>
      <FavoriteCharactersSection characters={characters} />
    </MemoryRouter>,
  );

describe('FavoriteCharactersSection', () => {
  it('shows an empty state when there are no favorites', () => {
    renderSection([]);
    expect(screen.getByText('Sin personajes favoritos')).toBeInTheDocument();
  });

  it('shows only the first row of 4 and hides "Ver más" when there is nothing more', () => {
    renderSection(makeCharacters(4));
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.queryByText('Ver más')).not.toBeInTheDocument();
  });

  it('caps the first row at 4 even when there are more favorites', () => {
    renderSection(makeCharacters(10));
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getByText('Ver más')).toBeInTheDocument();
  });

  it('reveals 4 more per click and stops offering "Ver más" at the end', async () => {
    const user = userEvent.setup();
    renderSection(makeCharacters(10));

    await user.click(screen.getByText('Ver más'));
    expect(screen.getAllByRole('link')).toHaveLength(8);

    await user.click(screen.getByText('Ver más'));
    expect(screen.getAllByRole('link')).toHaveLength(10);
    expect(screen.queryByText('Ver más')).not.toBeInTheDocument();
  });

  it('collapses back to a single row with "Ver menos"', async () => {
    const user = userEvent.setup();
    renderSection(makeCharacters(10));

    await user.click(screen.getByText('Ver más'));
    await user.click(screen.getByText('Ver menos'));

    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.queryByText('Ver menos')).not.toBeInTheDocument();
  });

  // Ahora cada favorito lleva a la ficha propia del personaje; el anime de
  // origen viaja como query param porque la API de MAL no lo devuelve.
  it('links each character to its own shareable page, carrying the source anime', () => {
    renderSection(makeCharacters(1));
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/personaje/1?anime=100&titulo=Anime%201',
    );
  });
});
