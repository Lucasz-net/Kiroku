import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AnimeGrid } from './AnimeGrid';
import type { AnimeSortKey, SavedAnime } from '../../types/profile';

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  toastError: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ update: () => ({ eq: mocks.eq }) }),
  },
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));
vi.mock('../../lib/monitoring', () => ({ reportError: mocks.reportError }));
// La portada real pide datos a Jikan y escribe en Supabase; acá no aporta nada.
vi.mock('../SavedAnimeCover', () => ({
  SavedAnimeCover: ({ title }: { title: string }) => <img alt={title} />,
}));

const anime = (id: number, title: string, createdAt: string): SavedAnime => ({
  id: `row-${id}`,
  anime_id: id,
  title,
  image_url: '',
  status: 'Completado',
  episodes_total: 12,
  score: null,
  is_favorite: false,
  year: 2020,
  genres: [],
  duration: null,
  created_at: createdAt,
});

// Alfa es el más viejo y Zeta el más reciente: así el orden por fecha (Zeta
// arriba) y el alfabético (Alfa arriba) no se confunden entre sí.
const ANIMES = [
  anime(1, 'Alfa',  '2024-01-01T00:00:00Z'),
  anime(2, 'Medio', '2024-02-01T00:00:00Z'),
  anime(3, 'Zeta',  '2024-03-01T00:00:00Z'),
];

const titles = () =>
  screen.getAllByRole('heading', { level: 4 }).map(h => h.textContent);

/** Vista del dueño: guarda en Supabase y le avisa al padre, que es quien manda. */
const OwnerHarness = ({ initial = null }: { initial?: AnimeSortKey | null }) => {
  const [pref, setPref] = useState<AnimeSortKey | null>(initial);
  return (
    <MemoryRouter>
      <AnimeGrid
        animes={ANIMES}
        isOwner
        profileId="user-1"
        sortPreference={pref}
        onSortPreferenceChange={setPref}
      />
    </MemoryRouter>
  );
};

const visitor = (pref: AnimeSortKey | null) =>
  render(
    <MemoryRouter>
      <AnimeGrid animes={ANIMES} sortPreference={pref} />
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.eq.mockReset();
  mocks.toastError.mockReset();
  mocks.reportError.mockReset();
  localStorage.clear();
});

describe('AnimeGrid', () => {
  it('ordena la grilla del visitante con la preferencia guardada del dueño', () => {
    visitor('name_asc');
    expect(titles()).toEqual(['Alfa', 'Medio', 'Zeta']);
  });

  it('cae al orden por defecto cuando el dueño nunca eligió uno', () => {
    // La preferencia vieja del navegador del visitante no manda sobre una
    // lista ajena: solo cuenta lo que eligió el dueño.
    localStorage.setItem('kiroku:profile-anime-sort', 'name_asc');
    visitor(null);
    expect(titles()).toEqual(['Zeta', 'Medio', 'Alfa']);
  });

  it('no le muestra el selector de orden al visitante', () => {
    visitor('name_asc');
    expect(screen.queryByRole('button', { name: /Nombre \(A-Z\)/ })).not.toBeInTheDocument();
  });

  it('guarda el orden que elige el dueño para que lo vea su perfil público', async () => {
    mocks.eq.mockResolvedValue({ error: null });
    const user = userEvent.setup();
    render(<OwnerHarness />);

    await user.click(screen.getByRole('button', { name: /Agregados recientemente/ }));
    await user.click(screen.getByRole('option', { name: 'Nombre (A-Z)' }));

    expect(titles()).toEqual(['Alfa', 'Medio', 'Zeta']);
    await waitFor(() => expect(mocks.eq).toHaveBeenCalledWith('id', 'user-1'));
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('revierte y avisa cuando no se puede guardar el orden', async () => {
    mocks.eq.mockResolvedValue({ error: { message: 'network' } });
    const user = userEvent.setup();
    render(<OwnerHarness initial="name_asc" />);

    await user.click(screen.getByRole('button', { name: /Nombre \(A-Z\)/ }));
    await user.click(screen.getByRole('option', { name: 'Nombre (Z-A)' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledOnce());
    expect(titles()).toEqual(['Alfa', 'Medio', 'Zeta']);
    expect(mocks.reportError).toHaveBeenCalledOnce();
  });

  it('sube a la base el orden que el dueño ya tenía elegido en localStorage', async () => {
    localStorage.setItem('kiroku:profile-anime-sort', 'name_asc');
    mocks.eq.mockResolvedValue({ error: null });

    render(<OwnerHarness />);

    expect(titles()).toEqual(['Alfa', 'Medio', 'Zeta']);
    await waitFor(() => expect(mocks.eq).toHaveBeenCalledWith('id', 'user-1'));
    expect(mocks.eq).toHaveBeenCalledOnce();
  });
});
