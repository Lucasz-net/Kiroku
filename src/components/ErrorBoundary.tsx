import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-[#080A0F] flex items-center justify-center px-4 font-sans">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={26} className="text-[#FF3B3B]" />
          </div>
          <h1 className="text-white font-black text-xl mb-2">Algo salió mal</h1>
          <p className="text-zinc-500 text-sm mb-8">
            Ocurrió un error inesperado. Recargá la página para seguir usando Kiroku.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 bg-[#FF3B3B] text-white font-black px-6 py-3 rounded-xl hover:bg-[#e02d2d] transition-all text-sm uppercase tracking-widest"
          >
            <RotateCcw size={15} /> Recargar
          </button>
        </div>
      </div>
    );
  }
}
