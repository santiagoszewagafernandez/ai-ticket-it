import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, Platform } from 'react-native';
import { useSesion } from '../contexto/Sesion';
import { ChatCompra } from '../chat/ChatCompra';
import { normalizarUrl } from '../api/cliente';

/** @param {string} compraId */
export function useChat(compraId) {
  const { baseUrl, usuario, api } = useSesion();
  const [resultado, setResultado] = useState(/** @type {{origen: ChatCompra | null, estado: import('../chat/ChatCompra').EstadoChat}} */ ({
    origen: null, estado: { conexion: 'Conectando', error: '', mensajes: [], pendientes: [] },
  }));
  const chat = useMemo(() => {
    const sesion = new ChatCompra({
      compraId, usuarioId: usuario?.id ?? '', plataforma: Platform.OS,
      abrirSocket: () => new WebSocket(`${normalizarUrl(baseUrl).replace(/^http/, 'ws')}/compras/${encodeURIComponent(compraId)}/chat`),
      historial: (signal) => api.mensajes(compraId, signal),
      alCambiar: (estado) => setResultado({ origen: sesion, estado }),
    });
    return sesion;
  }, [api, baseUrl, compraId, usuario?.id]);
  useFocusEffect(useCallback(() => {
    if (usuario && AppState.currentState === 'active') chat.iniciar();
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && usuario) chat.iniciar();
      else chat.detener();
    });
    return () => { suscripcion.remove(); chat.detener(); };
  }, [chat, usuario]));
  const estado = resultado.origen === chat ? resultado.estado : chat.estado;
  return { ...estado, enviar: (/** @type {string} */ texto) => chat.enviar(texto),
    reintentar: (/** @type {string} */ id) => chat.reintentar(id), reconectar: () => chat.reconectar() };
}
