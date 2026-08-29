import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CharacterDetailModal } from './CharacterDetailModal';
import type { Character } from '../../types/anime';

const PORTRAIT = 'https://cdn.example.com/retrato.jpg';
const ALT_1 = 'https://cdn.example.com/alterna-1.jpg';
const ALT_2 = 'https://cdn.example.com/alterna-2.jpg';

vi.mock('../../services/malApi', () => ({
  getCharacterDetailMal: vi.fn(async () => ({
    description: 'Una biografía.',
    nicknames: [],
    favorites: 100,
    pictures: [ALT_1, ALT_2],
  })),
}));

// La traducción corre en segundo plano y no afecta a lo que se prueba acá.
vi.mock('../../services/translateApi', () => ({
  translateToSpanish: vi.fn(async (t: string) => t),
}));

const character: Character = {
  character: {
    mal_id: 1,
    name: 'Frieren',
    images: { jpg: { image_url: PORTRAIT, large_image_url: PORTRAIT } },
  },
  role: 'Main',
  favorites: 100,
};

const setup = (props: Partial<Parameters<typeof CharacterDetailModal>[0]> = {}) => {
  const onToggleFavorite = vi.fn();
  const onUpdateImage = vi.fn();
  render(
    <MemoryRouter><CharacterDetailModal
      character={character}
      animeId={100}
      animeTitle="Sousou no Frieren"
      isFavorite={false}
      canFavorite
      savedImage={null}
      onToggleFavorite={onToggleFavorite}
      onUpdateImage={onUpdateImage}
      onClose={vi.fn()}
      {...props}
    /></MemoryRouter>,
  );
  return { onToggleFavorite, onUpdateImage };
};

const galleryThumbs = () => screen.getAllByRole('button', { name: 'Ver imagen' });

beforeEach(() => vi.clearAllMocks());

describe('CharacterDetailModal — imagen de la tarjeta del perfil', () => {
  it('guarda el retrato cuando se marca favorito sin tocar la galería', async () => {
    const user = userEvent.setup();
    const { onToggleFavorite } = setup();

    await user.click(screen.getByTitle(/Agregar a favoritos/));
    expect(onToggleFavorite).toHaveBeenCalledWith(PORTRAIT);
  });

  it('guarda la imagen elegida en la galería, no el retrato', async () => {
    const user = userEvent.setup();
    const { onToggleFavorite } = setup();

    await waitFor(() => expect(galleryThumbs()).toHaveLength(3));
    await user.click(galleryThumbs()[2]); // retrato + 2 alternativas
    await user.click(screen.getByTitle(/Agregar a favoritos/));

    expect(onToggleFavorite).toHaveBeenCalledWith(ALT_2);
  });

  it('no ofrece cambiar la portada si la imagen mostrada ya es la guardada', async () => {
    setup({ isFavorite: true, savedImage: PORTRAIT });
    await waitFor(() => expect(galleryThumbs()).toHaveLength(3));

    expect(screen.queryByText(/Usar en mi perfil/i)).not.toBeInTheDocument();
    expect(screen.getByText(/En tu perfil/i)).toBeInTheDocument();
  });

  it('ofrece cambiar la portada al elegir otra imagen, y la aplica', async () => {
    const user = userEvent.setup();
    const { onUpdateImage } = setup({ isFavorite: true, savedImage: PORTRAIT });

    await waitFor(() => expect(galleryThumbs()).toHaveLength(3));
    await user.click(galleryThumbs()[1]);

    await user.click(screen.getByText(/Usar en mi perfil/i));
    expect(onUpdateImage).toHaveBeenCalledWith(ALT_1);
  });

  it('abre mostrando la imagen que el perfil ya tiene guardada', async () => {
    setup({ isFavorite: true, savedImage: ALT_2 });

    const shown = screen.getByAltText('Frieren') as HTMLImageElement;
    expect(shown.src).toBe(ALT_2);
    // Y esa es la que aparece marcada como la del perfil.
    await waitFor(() => expect(screen.getByText(/En tu perfil/i)).toBeInTheDocument());
  });

  it('no muestra controles de favorito a quien no inició sesión', () => {
    setup({ canFavorite: false });
    expect(screen.queryByTitle(/favoritos/i)).not.toBeInTheDocument();
  });
});
