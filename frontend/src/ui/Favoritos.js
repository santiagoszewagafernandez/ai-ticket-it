import { Text, View } from 'react-native';
import { Aviso, Boton, Carga } from './Componentes';
import { estilos as s } from './tema';

/** @param {{favoritos: ReturnType<import('../hooks/useFavoritos').useFavoritos>}} props */
export function EstadoFavoritos({ favoritos }) {
  return <View style={{ gap: 8 }}>
    <Carga consulta={favoritos} />
    <Aviso mensaje={favoritos.errorOperacion} />
    {!!favoritos.errorOperacion && <Boton titulo="Consultar favoritos" secundario onPress={favoritos.recargar} disabled={!!favoritos.pendienteId || favoritos.cargando} />}
    {!!favoritos.confirmacion && <Text style={s.ayuda} accessibilityLiveRegion="polite">{favoritos.confirmacion}</Text>}
  </View>;
}

/** @param {{eventoId: string, favoritos: ReturnType<import('../hooks/useFavoritos').useFavoritos>}} props */
export function BotonFavorito({ eventoId, favoritos }) {
  const guardado = favoritos.datos?.some((e) => e.id === eventoId) ?? false;
  const pendiente = favoritos.pendienteId === eventoId;
  return <Boton titulo={pendiente ? (guardado ? 'Quitando favorito…' : 'Guardando favorito…') : guardado ? 'Quitar de favoritos' : 'Guardar en favoritos'}
    secundario ocupado={pendiente} disabled={!favoritos.datos || favoritos.cargando || !!favoritos.error || !!favoritos.pendienteId}
    onPress={() => favoritos.cambiar(eventoId)} />;
}
