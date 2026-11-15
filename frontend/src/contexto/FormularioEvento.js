import { createContext, useContext, useState } from 'react';
import { formularioVacio } from '../formularios/evento';

/** @typedef {{formulario: import('../formularios/evento').FormularioEvento, setFormulario: import('react').Dispatch<import('react').SetStateAction<import('../formularios/evento').FormularioEvento>>, limpiar: () => void}} ContextoFormulario */
const Contexto = createContext(/** @type {ContextoFormulario | null} */ (null));

/** @param {{children: import('react').ReactNode}} props */
export function FormularioEventoProvider({ children }) {
  const [formulario, setFormulario] = useState(formularioVacio);
  return <Contexto.Provider value={{ formulario, setFormulario, limpiar: () => setFormulario(formularioVacio()) }}>{children}</Contexto.Provider>;
}

export function useFormularioEvento() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('Falta el formulario compartido del evento.');
  return contexto;
}
