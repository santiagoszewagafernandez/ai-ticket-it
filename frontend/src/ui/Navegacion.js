import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSesion } from '../contexto/Sesion';
import { colores, estilos as s } from './tema';
import { Boton } from './Componentes';

export function CabeceraUsuario() {
  const { usuario } = useSesion();
  return <View style={s.tarjeta}>
    <View><Text style={s.etiqueta}>AI TICKET IT</Text><Text style={s.ayuda}>{usuario?.nombre} · Demo</Text></View>
    <Boton titulo="Cambiar usuario" onPress={() => router.push('/usuarios')} secundario />
  </View>;
}

/** @param {{activa: string}} props */
export function Pestañas({ activa }) {
  return <SafeAreaView edges={['bottom']} style={{ backgroundColor: 'white', borderTopWidth: 1, borderColor: colores.borde }}>
    <View style={{ flexDirection: 'row' }}>{[
      ['Catálogo', '/'], ['Favoritos', '/favoritos'], ['Mis compras', '/compras'], ['Mis eventos', '/mis-eventos'],
    ].map(([nombre, ruta]) => <Pressable key={nombre ?? ''} onPress={() => ruta && router.replace(/** @type {'/' | '/favoritos' | '/compras' | '/mis-eventos'} */ (ruta))} disabled={!ruta}
      accessibilityRole="tab" accessibilityLabel={ruta ? nombre ?? '' : `${nombre}, próximamente`}
      accessibilityState={{ selected: activa === nombre, disabled: !ruta }}
      style={{ flex: 1, minHeight: 58, paddingVertical: 12, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: activa === nombre ? colores.azul : colores.secundario, fontSize: 12, fontWeight: activa === nombre ? '700' : '400' }}>{nombre}</Text>
      {!ruta && <Text style={{ fontSize: 9, color: colores.secundario }}>Próximamente</Text>}
    </Pressable>)}</View>
  </SafeAreaView>;
}
