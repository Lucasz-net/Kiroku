import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAnimeById, resetJikanCircuit, jikanCircuitState, JikanError } from './jikanApi';
import { invalidateCachePrefix } from '../utils/queryCache';

/**
 * Circuit breaker de Jikan.
 *
 * Existe porque reintentar contra una API caída es lo que convertía un
 * incidente de Jikan en la app golpeándolo durante toda la sesión del
 * usuario. Lo que se prueba acá es justamente lo que no se ve mirando el
 * código: que después de N fallos deje de salir a la red, que un 404 no
 * cuente como caída, y que al vencer la ventana pase UNA sola petición de
 * prueba y no todas juntas.
 *
 * Se usan timers falsos porque la cola serializa las peticiones con pausas
 * reales (380 ms entre una y otra, más los backoff de los reintentos): con
 * timers reales este archivo tardaría decenas de segundos.
 */

const okResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

const errorResponse = (status: number) => new Response('', { status });

/** Corre `run` mientras se adelantan los timers, para destrabar las pausas. */
async function withTimers<T>(run: () => Promise<T>): Promise<T> {
  const promise = run();
  // Alcanza para cubrir la pausa de la cola y los dos backoff de reintento.
  await vi.advanceTimersByTimeAsync(30_000);
  return promise;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  resetJikanCircuit();
  // Cada test arranca sin caché: si no, la segunda llamada al mismo id se
  // resolvería sin tocar la red y no probaría nada.
  invalidateCachePrefix('anime:');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('circuit breaker de Jikan', () => {
  it('deja de salir a la red después de 4 fallos seguidos', async () => {
    fetchMock.mockResolvedValue(errorResponse(504));

    for (let i = 1; i <= 4; i++) {
      invalidateCachePrefix('anime:');
      await withTimers(() => getAnimeById(String(i)).catch(() => null));
    }

    expect(jikanCircuitState().open).toBe(true);

    const callsBefore = fetchMock.mock.calls.length;
    invalidateCachePrefix('anime:');
    await expect(getAnimeById('99')).rejects.toBeInstanceOf(JikanError);

    // Lo importante: la petición número cinco no llegó a la red.
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it('un 404 no cuenta como caída: el anime no existe, Jikan está sano', async () => {
    fetchMock.mockResolvedValue(errorResponse(404));

    for (let i = 1; i <= 6; i++) {
      invalidateCachePrefix('anime:');
      await withTimers(() => getAnimeById(String(i)).catch(() => null));
    }

    expect(jikanCircuitState().open).toBe(false);
    expect(jikanCircuitState().consecutiveFailures).toBe(0);
  });

  it('una respuesta buena reinicia la cuenta de fallos', async () => {
    fetchMock.mockResolvedValue(errorResponse(504));
    invalidateCachePrefix('anime:');
    await withTimers(() => getAnimeById('1').catch(() => null));
    expect(jikanCircuitState().consecutiveFailures).toBeGreaterThan(0);

    fetchMock.mockResolvedValue(okResponse({ data: { mal_id: 1 } }));
    invalidateCachePrefix('anime:');
    await withTimers(() => getAnimeById('2'));

    expect(jikanCircuitState().consecutiveFailures).toBe(0);
    expect(jikanCircuitState().open).toBe(false);
  });

  it('al vencer la ventana deja pasar una sola prueba, no todas juntas', async () => {
    fetchMock.mockResolvedValue(errorResponse(504));
    for (let i = 1; i <= 4; i++) {
      invalidateCachePrefix('anime:');
      await withTimers(() => getAnimeById(String(i)).catch(() => null));
    }
    expect(jikanCircuitState().open).toBe(true);

    // Pasan los 5 minutos de la ventana.
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1000);
    expect(jikanCircuitState().open).toBe(false);

    const callsBefore = fetchMock.mock.calls.length;
    // Nunca resuelve: mantiene la prueba en vuelo mientras entran las demás.
    fetchMock.mockReturnValue(new Promise(() => {}));

    invalidateCachePrefix('anime:');
    const probe = getAnimeById('10').catch(() => null);

    // Con la prueba todavía en vuelo, cualquier otra tiene que fallar sola.
    invalidateCachePrefix('anime:');
    await expect(getAnimeById('11')).rejects.toBeInstanceOf(JikanError);
    invalidateCachePrefix('anime:');
    await expect(getAnimeById('12')).rejects.toBeInstanceOf(JikanError);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock.mock.calls.length).toBe(callsBefore + 1);
    void probe;
  });
});
