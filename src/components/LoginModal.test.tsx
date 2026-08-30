import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginModal } from './LoginModal';

const { setSession, rpc, resetPasswordForEmail, signInWithPassword } = vi.hoisted(() => ({
  setSession: vi.fn(),
  rpc: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      setSession,
      signInWithPassword,
      resetPasswordForEmail,
      signInWithOAuth: vi.fn(),
      signUp: vi.fn(),
    },
    rpc,
  },
}));

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
}) as Response;

describe('LoginModal - login flow', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setSession.mockReset().mockResolvedValue({ error: null });
    rpc.mockReset();
    resetPasswordForEmail.mockReset();
    signInWithPassword.mockReset();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  // El navegador nunca resuelve un nombre de usuario a su email: eso pasa
  // detrás de /api/auth/login con la service-role key. La RPC pública que
  // lo hacía antes filtraba el email de cualquier cuenta a cualquiera.
  it('sends the raw identifier to the server and never resolves the email client-side', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    fetchMock.mockResolvedValue(jsonResponse(200, { access_token: 'at', refresh_token: 'rt' }));

    render(<LoginModal isOpen onClose={onClose} />);

    await user.type(screen.getByLabelText(/Usuario o Correo Electrónico/i), 'Lucasz');
    await user.type(screen.getByPlaceholderText('••••••••'), 'supersecret');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ identifier: 'Lucasz', password: 'supersecret' }),
    })));

    expect(rpc).not.toHaveBeenCalled();
    expect(signInWithPassword).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('installs the returned tokens as the Supabase session', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(200, { access_token: 'at', refresh_token: 'rt' }));

    render(<LoginModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Usuario o Correo Electrónico/i), 'lucas@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'supersecret');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(setSession).toHaveBeenCalledWith({
      access_token: 'at',
      refresh_token: 'rt',
    }));
  });

  // El mensaje tiene que ser el mismo para "no existe la cuenta" y para
  // "contraseña incorrecta": afinarlo convierte el formulario en un
  // detector de qué cuentas existen.
  it('shows the ambiguous server error verbatim on a rejected login', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'Usuario o contraseña incorrectos.' }));

    render(<LoginModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Usuario o Correo Electrónico/i), 'lucas@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Usuario o contraseña incorrectos.')).toBeInTheDocument();
    expect(setSession).not.toHaveBeenCalled();
  });

  it('surfaces the throttling message when the server rate-limits the attempt', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(429, { error: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' }));

    render(<LoginModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Usuario o Correo Electrónico/i), 'lucas@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'whatever');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/Demasiados intentos/i)).toBeInTheDocument();
  });

  it('asks the server for the reset link and never calls resetPasswordForEmail directly', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    render(<LoginModal isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    await user.type(screen.getByLabelText(/Usuario o Correo Electrónico/i), 'lucas@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar Enlace' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/reset-password', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ identifier: 'lucas@example.com' }),
    })));

    // El redirectTo lo arma el servidor a partir de su propio host; que lo
    // mande el cliente lo convertiría en un open redirect.
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(await screen.findByText(/Si el usuario o correo existe/i)).toBeInTheDocument();
  });

  // La base rechaza estos nombres con un CHECK; sin este guardia el usuario
  // recibiría un "Database error saving new user" desde el trigger.
  it('rejects an invalid username at signup before touching the network', async () => {
    const user = userEvent.setup();

    render(<LoginModal isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Registrarse' }));
    await user.type(screen.getByLabelText(/Nombre de Usuario/i), 'ab');
    await user.type(screen.getByLabelText(/Correo Electrónico/i), 'lucas@example.com');
    // Con dígito: la contraseña se valida antes que el username, así que una
    // que no cumpla la política taparía el error que este test busca.
    await user.type(screen.getByPlaceholderText('••••••••'), 'supersecret1');
    await user.click(screen.getByRole('button', { name: 'Crear Cuenta' }));

    expect(await screen.findByText(/entre 3 y 20 caracteres/i)).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  // La política del dashboard de Supabase pide letras y dígitos. Sin este
  // guardia, GoTrue rechaza el registro con un mensaje en inglés que enumera
  // el alfabeto entero — después de que el formulario dijo que estaba bien.
  it('rejects a password that meets the length but not the character policy', async () => {
    const user = userEvent.setup();

    render(<LoginModal isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Registrarse' }));
    await user.type(screen.getByLabelText(/Nombre de Usuario/i), 'lucas');
    await user.type(screen.getByLabelText(/Correo Electrónico/i), 'lucas@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'contraseña');
    await user.click(screen.getByRole('button', { name: 'Crear Cuenta' }));

    expect(await screen.findByText(/letras y números/i)).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('shows the same anti-enumeration message for an unknown identifier', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    render(<LoginModal isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    await user.type(screen.getByLabelText(/Usuario o Correo Electrónico/i), 'no-such-user');
    await user.click(screen.getByRole('button', { name: 'Enviar Enlace' }));

    expect(await screen.findByText(/Si el usuario o correo existe/i)).toBeInTheDocument();
  });
});
