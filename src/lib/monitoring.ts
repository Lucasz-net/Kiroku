import * as Sentry from '@sentry/react';

/**
 * Reporte de errores.
 *
 * Hasta ahora, cuando algo se rompía para un usuario, el ErrorBoundary
 * mostraba "Algo salió mal" y hacía console.error en la consola de esa
 * persona. Nadie se enteraba nunca. Con usuarios reales eso es quedarse
 * ciego justo el día que más importa ver.
 *
 * Se activa solo si hay `VITE_SENTRY_DSN`: sin la variable, todo lo de acá
 * es una función vacía y no se envía nada. Así el desarrollo local y
 * cualquier fork siguen funcionando sin cuenta de Sentry.
 */
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export const monitoringEnabled = Boolean(dsn);

export function initMonitoring() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Muestreo de trazas al 10%: alcanza para ver tendencias de rendimiento
    // sin gastar la cuota gratuita en el primer día de tráfico.
    tracesSampleRate: 0.1,
    // Nada de session replay ni de datos personales por defecto: la política
    // de privacidad dice que no compartimos datos con terceros más allá de
    // lo necesario, y un replay de la sesión es justamente lo contrario.
    sendDefaultPii: false,
    beforeSend(event) {
      // El email nunca sale de la app.
      if (event.user) delete event.user.email;
      return event;
    },
  });
}

/** Reporta un error ya capturado (ErrorBoundary, catch de red, etc.). */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * Asocia los errores al usuario para poder responderle si escribe. Solo el
 * id: ni email ni nombre de usuario.
 */
export function setMonitoringUser(userId: string | null) {
  if (!dsn) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
