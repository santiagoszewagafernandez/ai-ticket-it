import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colores, estilos as s } from './tema';

/** @param {{titulo: string, onPress: () => void, disabled?: boolean, secundario?: boolean, ocupado?: boolean}} props */
export function Boton({ titulo, onPress, disabled = false, secundario = false, ocupado = false }) {
  return <Pressable onPress={onPress} disabled={disabled || ocupado} accessibilityRole="button"
    accessibilityState={{ disabled: disabled || ocupado, busy: ocupado }}
    style={({ pressed }) => [s.boton, secundario && s.botonSecundario, (disabled || ocupado || pressed) && { opacity: 0.55 }]}>
    <Text style={[s.botonTexto, secundario && { color: colores.azul }]}>{titulo}</Text>
  </Pressable>;
}

/** @param {{mensaje: string}} props */
export function Aviso({ mensaje }) {
  return mensaje ? <View style={s.tarjeta} accessibilityLiveRegion="polite"><Text style={s.error} accessibilityRole="alert">{mensaje}</Text></View> : null;
}

/** @param {{consulta: {cargando: boolean, error: string, recargar: () => void}}} props */
export function Carga({ consulta }) {
  if (consulta.cargando) return <View style={s.tarjeta}><ActivityIndicator color={colores.azul} /><Text style={s.ayuda}>Cargando…</Text></View>;
  if (consulta.error) return <View style={s.tarjeta}><Aviso mensaje={consulta.error} /><Boton titulo="Volver a consultar" onPress={consulta.recargar} secundario /></View>;
  return null;
}

/** @param {{titulo: string, seleccionada: boolean, onPress: () => void, disabled?: boolean}} props */
export function Opcion({ titulo, seleccionada, onPress, disabled = false }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="radio"
    accessibilityState={{ selected: seleccionada, disabled }}
    style={[s.input, { minWidth: 64, justifyContent: 'center' }, seleccionada && { borderColor: colores.azul, backgroundColor: '#E4ECF8', borderWidth: 2 }, disabled && { opacity: 0.5 }]}>
    <Text style={[s.ayuda, seleccionada && { color: colores.azul, fontWeight: '700' }]}>{titulo}</Text>
  </Pressable>;
}
