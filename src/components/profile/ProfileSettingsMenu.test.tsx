import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileSettingsMenu } from './ProfileSettingsMenu';
import { ThemeProvider } from '../../contexts/ThemeContext';
import type { UserProfile } from '../../types/profile';

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

const BASE: UserProfile = {
  id: 'user-1',
  username: 'lucas',
  email: 'lucas@example.com',
  avatar_url: null,
  banner_url: null,
  bio: null,
  is_private: false,
  comments_enabled: true,
};

/**
 * El menú es controlado: escribe en Supabase y le avisa al padre, que es
 * quien guarda el estado. Este wrapper hace de padre para poder observar el
 * ida y vuelta completo (optimista y reversión).
 */
const Harness = () => {
  const [profile, setProfile] = useState(BASE);
  return (
    <ThemeProvider>
      <ProfileSettingsMenu
        profile={profile}
        onPrivacyToggle={v => setProfile(p => ({ ...p, is_private: v }))}
        onCommentsToggle={v => setProfile(p => ({ ...p, comments_enabled: v }))}
        onSignOut={() => {}}
      />
    </ThemeProvider>
  );
};

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Configuración del perfil' }));
};

const privacySwitch = () => screen.getByRole('switch', { name: /Perfil privado/ });

beforeEach(() => {
  mocks.eq.mockReset();
  mocks.toastError.mockReset();
  mocks.reportError.mockReset();
});

describe('ProfileSettingsMenu', () => {
  it('mueve el interruptor antes de que termine el guardado', async () => {
    // Guardado que no resuelve hasta que el test lo decida: así se puede
    // comprobar que el switch ya se movió mientras la escritura sigue en
    // vuelo, que es todo el punto de la actualización optimista.
    let finish: (result: { error: null }) => void = () => {};
    mocks.eq.mockReturnValue(new Promise(resolve => { finish = resolve; }));

    const user = userEvent.setup();
    render(<Harness />);
    await openMenu(user);

    expect(privacySwitch()).toHaveAttribute('aria-checked', 'false');
    await user.click(privacySwitch());
    expect(privacySwitch()).toHaveAttribute('aria-checked', 'true');

    finish({ error: null });
    await waitFor(() => expect(privacySwitch()).toBeEnabled());
    expect(privacySwitch()).toHaveAttribute('aria-checked', 'true');
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('revierte el interruptor y avisa cuando el guardado falla', async () => {
    mocks.eq.mockResolvedValue({ error: { message: 'network' } });

    const user = userEvent.setup();
    render(<Harness />);
    await openMenu(user);
    await user.click(privacySwitch());

    await waitFor(() => expect(privacySwitch()).toHaveAttribute('aria-checked', 'false'));
    expect(mocks.toastError).toHaveBeenCalledOnce();
    expect(mocks.reportError).toHaveBeenCalledOnce();
  });

  it('deja el menú abierto al tocar un interruptor y lo cierra al ejecutar una acción', async () => {
    mocks.eq.mockResolvedValue({ error: null });
    const onImportClick = vi.fn();

    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ProfileSettingsMenu
          profile={BASE}
          onImportClick={onImportClick}
          onSignOut={() => {}}
        />
      </ThemeProvider>,
    );
    await openMenu(user);

    await user.click(privacySwitch());
    expect(privacySwitch()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Importar desde MyAnimeList/ }));
    expect(onImportClick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('switch', { name: /Perfil privado/ })).not.toBeInTheDocument();
  });

  // Las dos importaciones son filas distintas y tienen que poder convivir:
  // la de MAL pide un archivo y la de AniList solo el nombre de usuario.
  it('ofrece las dos importaciones por separado', async () => {
    const onImportClick = vi.fn();
    const onAniListImportClick = vi.fn();

    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ProfileSettingsMenu
          profile={BASE}
          onImportClick={onImportClick}
          onAniListImportClick={onAniListImportClick}
          onSignOut={() => {}}
        />
      </ThemeProvider>,
    );
    await openMenu(user);

    await user.click(screen.getByRole('button', { name: /Importar desde AniList/ }));
    expect(onAniListImportClick).toHaveBeenCalledOnce();
    expect(onImportClick).not.toHaveBeenCalled();
  });

  it('no muestra la fila de AniList si no le pasan la acción', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ProfileSettingsMenu profile={BASE} onImportClick={vi.fn()} onSignOut={() => {}} />
      </ThemeProvider>,
    );
    await openMenu(user);

    expect(screen.queryByRole('button', { name: /Importar desde AniList/ })).not.toBeInTheDocument();
  });

  it('cierra con Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openMenu(user);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('switch', { name: /Perfil privado/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configuración del perfil' })).toHaveFocus();
  });

  it('trata un perfil sin comments_enabled como comentarios abiertos', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ProfileSettingsMenu
          profile={{ ...BASE, comments_enabled: undefined }}
          onSignOut={() => {}}
        />
      </ThemeProvider>,
    );
    await openMenu(user);

    expect(screen.getByRole('switch', { name: /Comentarios abiertos/ }))
      .toHaveAttribute('aria-checked', 'true');
  });
});
