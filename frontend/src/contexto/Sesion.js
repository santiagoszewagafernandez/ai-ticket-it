import { createContext, useContext, useMemo, useState } from 'react';
import { crearApi } from '../api/cliente';

/** @typedef {{baseUrl: string, setBaseUrl: (url: string) => void, usuario: import('../api/tipos').Usuario | null, setUsuario: (usuario: import('../api/tipos').Usuario | null) => void, api: ReturnType<typeof crearApi>}} Sesion */
const Contexto = createContext(/** @type {Sesion | null} */ (null));

/** @param {{children: import('react').ReactNode}} props */
export function SesionProvider({ children }) {
  const [baseUrl, setBaseUrl] = useState(process.env.EXPO_PUBLIC_API_URL ?? '');
  const [usuario, setUsuario] = useState(/** @type {import('../api/tipos').Usuario | null} */ (null));
  const api = useMemo(() => crearApi(baseUrl, usuario?.id), [baseUrl, usuario?.id]);
  return <Contexto.Provider value={{ baseUrl, setBaseUrl, usuario, setUsuario, api }}>{children}</Contexto.Provider>;
}

export function useSesion() {
  const sesion = useContext(Contexto);
  if (!sesion) throw new Error('La sesión debe estar dentro de SesionProvider.');
  return sesion;
}
