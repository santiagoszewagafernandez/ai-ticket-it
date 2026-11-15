import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';

/** @template T
 * @param {(signal: AbortSignal) => Promise<T>} cargar
 */
export function useConsulta(cargar) {
  const [version, setVersion] = useState(0);
  const [resultado, setResultado] = useState({ datos: /** @type {T | null} */ (null), cargando: true, error: '' });
  const [origen, setOrigen] = useState(() => cargar);
  const recargar = useCallback(() => setVersion((valor) => valor + 1), []);
  useFocusEffect(useCallback(() => {
    void version; // Una recarga explícita vuelve a ejecutar esta sincronización.
    const controller = new AbortController();
    setOrigen(() => cargar);
    setResultado({ datos: null, cargando: true, error: '' });
    cargar(controller.signal).then((datos) => {
      if (!controller.signal.aborted) setResultado({ datos, cargando: false, error: '' });
    }).catch((error) => {
      if (!controller.signal.aborted) setResultado({ datos: null, cargando: false, error: error instanceof Error ? error.message : 'No se pudo consultar.' });
    });
    const suscripcion = AppState.addEventListener('change', (estado) => { if (estado === 'active') recargar(); });
    return () => { controller.abort(); suscripcion.remove(); };
  }, [cargar, recargar, version]));
  return { ...(origen === cargar ? resultado : { datos: null, cargando: true, error: '' }), recargar };
}
