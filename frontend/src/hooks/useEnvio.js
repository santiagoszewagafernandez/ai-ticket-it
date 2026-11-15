import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ErrorSolicitud } from '../api/cliente';

export function useEnvio() {
  const pendiente = useRef(/** @type {AbortController | null} */ (null));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [incierto, setIncierto] = useState(false);
  useFocusEffect(useCallback(() => () => {
    pendiente.current?.abort();
    pendiente.current = null;
    setOcupado(false);
  }, []));
  /** @template T
   * @param {(signal: AbortSignal) => Promise<T>} accion
   * @param {(datos: T) => void} exito
   */
  async function enviar(accion, exito) {
    if (pendiente.current) return;
    const controller = new AbortController();
    pendiente.current = controller;
    setOcupado(true);
    setError('');
    setIncierto(false);
    try {
      const datos = await accion(controller.signal);
      if (!controller.signal.aborted) exito(datos);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'No se pudo completar la operación.');
        setIncierto(err instanceof ErrorSolicitud && ['NETWORK_ERROR', 'INVALID_RESPONSE'].includes(err.code));
      }
    } finally {
      if (pendiente.current === controller) { pendiente.current = null; setOcupado(false); }
    }
  }
  return { ocupado, error, incierto, enviar };
}
