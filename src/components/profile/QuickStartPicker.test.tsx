import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QuickStartPicker } from './QuickStartPicker';
import type { Anime } from '../../types/anime';

const mocks = vi.hoisted(() => ({
  searchAniList: vi.fn(),
  upsert: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('../../services/aniListApi', () => ({ searchAniList: mocks.searchAniList }));
vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ upsert: mocks.upsert }) },
}));
vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

const anime = (id: number): Anime => ({
  mal_id: id,
  title: `Anime ${id}`,
  episodes: 12,
  images: { jpg: { image_url: `${id}.jpg`, large_image_url: `${id}-l.jpg` } },
});

const page = (ids: number[], hasNextPage = true) => ({
  data: ids.map(anime),
  hasNextPage,
});

const renderPicker = (onSaved = vi.fn()) =>
  render(
    <MemoryRouter>
      <QuickStartPicker userId="user-1" onSaved={onSaved} />
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.searchAniList.mockReset();
  mocks.upsert.mockReset().mockResolvedValue({ error: null });
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
});

describe('QuickStartPicker', () => {
  it('ofrece una salida al buscador para quien no vio ninguno', async () => {
    mocks.searchAniList.mockResolvedValue(page([1, 2]));
    renderPicker();

    const escape = await screen.findByRole('link', { name: /No viste ninguno/ });
    expect(escape).toHaveAttribute('href', '/search');
  });

  it('renueva la tanda con "Ver otros" en vez de dejar siempre los mismos', async () => {
    mocks.searchAniList
      .mockResolvedValueOnce(page([1, 2]))
      .mockResolvedValueOnce(page([3, 4]));

    const user = userEvent.setup();
    renderPicker();
    await screen.findByRole('button', { name: 'Anime 1' });

    await user.click(screen.getByRole('button', { name: /Ver otros/ }));

    await screen.findByRole('button', { name: 'Anime 3' });
    expect(screen.queryByRole('button', { name: 'Anime 1' })).not.toBeInTheDocument();
    expect(mocks.searchAniList).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  // Lo elegido vive en un Map con el anime entero justamente por esto: al
  // cambiar de tanda, `options` ya no lo contiene.
  it('guarda lo marcado en tandas distintas', async () => {
    mocks.searchAniList
      .mockResolvedValueOnce(page([1, 2]))
      .mockResolvedValueOnce(page([3, 4]));

    const user = userEvent.setup();
    renderPicker();

    await user.click(await screen.findByRole('button', { name: 'Anime 1' }));
    await user.click(screen.getByRole('button', { name: /Ver otros/ }));
    await user.click(await screen.findByRole('button', { name: 'Anime 3' }));

    expect(screen.getByRole('button', { name: 'Guardar 2' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar 2' }));

    await waitFor(() => expect(mocks.upsert).toHaveBeenCalledOnce());
    const rows = mocks.upsert.mock.calls[0][0];
    expect(rows.map((r: { anime_id: number }) => r.anime_id)).toEqual([1, 3]);
    expect(rows.every((r: { status: string }) => r.status === 'Completado')).toBe(true);
  });

  it('mantiene la tanda visible si falla la carga de más', async () => {
    mocks.searchAniList
      .mockResolvedValueOnce(page([1, 2]))
      .mockRejectedValueOnce(new Error('red caída'));

    const user = userEvent.setup();
    renderPicker();
    await screen.findByRole('button', { name: 'Anime 1' });

    await user.click(screen.getByRole('button', { name: /Ver otros/ }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Anime 1' })).toBeInTheDocument();
  });

  it('esconde "Ver otros" cuando no queda nada más que sugerir', async () => {
    mocks.searchAniList.mockResolvedValue(page([1, 2], false));
    renderPicker();

    await screen.findByRole('button', { name: 'Anime 1' });
    expect(screen.queryByRole('button', { name: /Ver otros/ })).not.toBeInTheDocument();
  });
});
