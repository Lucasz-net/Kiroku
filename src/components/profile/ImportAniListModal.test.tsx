import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportAniListModal } from './ImportAniListModal';
import { AniListUserNotFoundError } from '../../services/aniListImport';

const mocks = vi.hoisted(() => ({ fetchList: vi.fn() }));

vi.mock('../../services/aniListImport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/aniListImport')>();
  return { ...actual, fetchAniListUserList: mocks.fetchList };
});
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ upsert: vi.fn() }) } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const renderModal = (existing: number[] = []) =>
  render(
    <ImportAniListModal
      userId="user-1"
      existingAnimeIds={new Set(existing)}
      onClose={() => {}}
      onImportComplete={() => {}}
    />,
  );

const entry = (malId: number, over: Record<string, unknown> = {}) => ({
  malId, title: `Anime ${malId}`, imageUrl: '', totalEpisodes: 12, watchedEpisodes: 12,
  userScore: 8, aniListStatus: 'COMPLETED', status: 'Completado', score: 8,
  year: 2020, genres: [], studios: [], duration: null, ...over,
});


// A propósito no hay `beforeEach` reseteando el mock: con Vitest 4, resetear
// un `vi.fn()` cuyo resultado registrado fue un error hace que ese error se
// reporte como fallo del test, aunque el componente lo haya capturado y
// mostrado bien (comprobado mirando el DOM). Cada test define su propia
// implementación, que pisa la anterior, así que no hace falta.
describe('ImportAniListModal', () => {
  it('no sale a buscar nada si el campo está vacío', async () => {
    mocks.fetchList.mockClear();
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: /Buscar mi lista/i }));

    expect(mocks.fetchList).not.toHaveBeenCalled();
    expect(screen.getByText(/Escribí tu nombre de usuario/i)).toBeInTheDocument();
  });

  // El error más probable de todos: un typo en el nombre. Tiene que decir qué
  // pasó y volver al formulario, no dejar la ventana colgada.
  it('explica cuándo la cuenta no existe y deja reintentar', async () => {
    // Lanza en vez de devolver una promesa rechazada. El `try` del
    // componente atrapa las dos cosas igual, pero así no se crea ninguna
    // promesa que el rastreo de resultados de `vi.fn()` pueda informar
    // como rechazo no capturado.
    mocks.fetchList.mockImplementation(() => { throw new AniListUserNotFoundError('nadie'); });
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/Tu usuario de AniList/i), 'nadie');
    await user.click(screen.getByRole('button', { name: /Buscar mi lista/i }));

    expect(await screen.findByText(/No encontramos la cuenta "nadie"/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Buscar mi lista/i })).toBeInTheDocument();
  });

  // Una cuenta que existe pero con la lista privada devuelve 0 entradas sin
  // error: sin este aviso la ventana se quedaba muda.
  it('avisa cuando la lista está vacía o no es pública', async () => {
    mocks.fetchList.mockResolvedValue({ entries: [], withoutMalId: 0 });
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/Tu usuario de AniList/i), 'alguien');
    await user.click(screen.getByRole('button', { name: /Buscar mi lista/i }));

    expect(await screen.findByText(/está vacía o no es pública/i)).toBeInTheDocument();
  });

  it('acepta que peguen el enlace del perfil en vez del usuario', async () => {
    mocks.fetchList.mockResolvedValue({ entries: [entry(1)], withoutMalId: 0 });
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText(/Tu usuario de AniList/i), 'https://anilist.co/user/Luxioz/animelist');
    await user.click(screen.getByRole('button', { name: /Buscar mi lista/i }));

    await screen.findByText(/Lista de Luxioz/i);
    expect(mocks.fetchList).toHaveBeenCalledWith('Luxioz', expect.any(Function));
  });

  it('en la vista previa descuenta lo que ya está guardado', async () => {
    mocks.fetchList.mockResolvedValue({ entries: [entry(1), entry(2), entry(3)], withoutMalId: 0 });
    const user = userEvent.setup();
    renderModal([1, 2]);

    await user.type(screen.getByLabelText(/Tu usuario de AniList/i), 'alguien');
    await user.click(screen.getByRole('button', { name: /Buscar mi lista/i }));

    // De tres entradas, dos ya estaban: solo se ofrece importar una.
    expect(await screen.findByRole('button', { name: /Importar 1 anime$/i })).toBeInTheDocument();
  });
});
