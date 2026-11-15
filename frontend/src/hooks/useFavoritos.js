import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { useSesion } from '../contexto/Sesion';
import { ListaFavoritos } from '../favoritos/ListaFavoritos';

export function useFavoritos() {
  const { api, usuario } = useSesion();
  const lista = useMemo(() => new ListaFavoritos(api), [api]);
  const [resultado, setResultado] = useState({ origen: lista, estado: lista.estado });
  useFocusEffect(useCallback(() => {
    const quitar = lista.suscribir((estado) => setResultado({ origen: lista, estado }));
    if (usuario) void lista.cargar();
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && usuario) void lista.cargar();
      else lista.detener();
    });
    return () => { quitar(); suscripcion.remove(); lista.detener(); };
  }, [lista, usuario]));
  // Ni un frame con datos de otra identidad/URL mientras se monta el nuevo efecto.
  const estado = resultado.origen === lista ? resultado.estado : lista.estado;
  return { ...estado, recargar: () => { void lista.cargar(); }, cambiar: (/** @type {string} */ id) => { void lista.cambiar(id); } };
}
