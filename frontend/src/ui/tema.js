import { StyleSheet } from 'react-native';

export const colores = { fondo: '#F3F5F9', tinta: '#17283E', secundario: '#4C5F75', azul: '#2054A5', borde: '#B0BDCE', blanco: '#FFFFFF', error: '#A02121' };
export const estilos = StyleSheet.create({
  pagina: { flex: 1, backgroundColor: colores.fondo },
  contenido: { padding: 20, paddingBottom: 36, gap: 16 },
  tarjeta: { backgroundColor: colores.blanco, padding: 18, borderRadius: 16, gap: 10 },
  titulo: { fontSize: 28, fontWeight: '700', color: colores.tinta },
  subtitulo: { fontSize: 20, fontWeight: '700', color: colores.tinta },
  texto: { fontSize: 16, lineHeight: 24, color: colores.tinta },
  ayuda: { fontSize: 14, lineHeight: 21, color: colores.secundario },
  etiqueta: { fontSize: 14, fontWeight: '700', color: colores.azul },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  input: { borderWidth: 1, borderColor: colores.borde, backgroundColor: colores.blanco, borderRadius: 10, padding: 12, minHeight: 48, fontSize: 16, color: colores.tinta },
  boton: { backgroundColor: colores.azul, borderRadius: 10, padding: 14, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  botonSecundario: { backgroundColor: '#E4ECF8' },
  botonTexto: { color: colores.blanco, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  error: { color: colores.error, fontSize: 15, lineHeight: 23 },
  separador: { height: 12 },
});

/** @param {number | null} centavos */
export const dinero = (centavos) => centavos === null ? 'Sin disponibilidad' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(centavos / 100);
/** @param {string} iso */
export const fecha = (iso) => new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
/** @type {Record<string, string>} */
const nombresEstado = { PENDIENTE: 'Pendiente de pago', CONFIRMADA: 'Confirmada', UTILIZADA: 'Utilizada', CANCELADA: 'Cancelada', REEMBOLSADA: 'Reembolsada', SIN_UTILIZAR: 'Sin utilizar' };
/** @param {string} estado */
export const estadoTexto = (estado) => nombresEstado[estado] ?? estado;
