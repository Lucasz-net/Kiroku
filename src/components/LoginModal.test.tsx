import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginModal } from './LoginModal';

const { signInWithPassword, rpc, resetPasswordForEmail } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  rpc: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword,
      resetPasswordForEmail,
      signInWithOAuth: vi.fn(),
      signUp: vi.fn(),
    },
    rpc,
  },
}));

describe('LoginModal - login flow', () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    rpc.mockReset();
    resetPasswordForEmail.mockReset();
  });

  it('logs in directly with an email identifier, without resolving a username first', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    signInWithPassword.mockResolvedValue({ error: null });

    render(<LoginModal isOpen onClose={onClose} />);

    await user.type(screen.getByLabelText(/Usuario o Correo Electrónico/i), 'lucas@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'supersecret');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'lucas@example.com',
      password: 'supersecret',
    }));
    expect(rpc).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('resolves a username identifier to an email via RPC before logging in', async () => {
    const user = userEvent.setup();
    rpc.mockResolvedValue({ data: 'lucas@example.com', error: null });
    signInWithPassword.mockResolvedValue({ error: null });

    render(<LoginModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Usuario o Correo Electrónico/i), 'Lucasz');
    await user.type(screen.getByPlaceholderText('••••••••'), 'supersecret');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith('get_email_for_login', { p_username: 'Lucasz' }));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'lucas@example.com', password: 'supersecret' });
  });

  it('shows a friendly error message on invalid credentials', async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({ error: new Error('Invalid login credentials') });

    render(<LoginModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Usuario o Correo Electrónico/i), 'lucas@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Contraseña incorrecta.')).toBeInTheDocument();
  });

  it('sends a password reset link and shows the same message whether or not the account exists', async () => {
    const user = userEvent.setup();
    resetPasswordForEmail.mockResolvedValue({ error: null });

    render(<LoginModal isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    await user.type(screen.getByLabelText(/Usuario o Correo Electrónico/i), 'lucas@example.com');
    await user.click(screen.getByRole('button', { name: 'Enviar Enlace' }));

    await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalledWith(
      'lucas@example.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('/restablecer-contrasena') }),
    ));
    expect(await screen.findByText(/Si el usuario o correo existe/i)).toBeInTheDocument();
  });

  it('shows the same anti-enumeration message even when the username lookup fails', async () => {
    const user = userEvent.setup();
    rpc.mockResolvedValue({ data: null, error: null });

    render(<LoginModal isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    await user.type(screen.getByLabelText(/Usuario o Correo Electrónico/i), 'no-such-user');
    await user.click(screen.getByRole('button', { name: 'Enviar Enlace' }));

    expect(await screen.findByText(/Si el usuario o correo existe/i)).toBeInTheDocument();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
