import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

const Bomb = () => {
  throw new Error('boom');
};

describe('ErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    render(<ErrorBoundary><p>all good</p></ErrorBoundary>);
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('shows a fallback screen instead of a blank page when a child throws during render', () => {
    // React logs the error to the console too; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ErrorBoundary><Bomb /></ErrorBoundary>);

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Recargar/i })).toBeInTheDocument();
    expect(screen.queryByText('all good')).not.toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
