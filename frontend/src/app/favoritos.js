import { Redirect, router } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSesion } from '../contexto/Sesion';
import { useFavoritos } from '../hooks/useFavoritos';
import { Boton } from '../ui/Componentes';
import { EstadoFavoritos } from '../ui/Favoritos';
import { CabeceraUsuario, Pestañas } from '../ui/Navegacion';
import { TarjetaEvento } from '../ui/TarjetaEvento';
import { estilos as s } from '../ui/tema';

export default function Favoritos() {
  const { usuario } = useSesion();
  const favoritos = useFavoritos();
  if (!usuario) return <Redirect href="/usuarios" />;
  return <SafeAreaView edges={['top', 'left', 'right']} style={s.pagina}>
    <FlatList data={favoritos.datos ?? []} keyExtractor={(e) => e.id} contentContainerStyle={s.contenido}
      refreshing={favoritos.cargando} onRefresh={favoritos.recargar} ItemSeparatorComponent={() => <View style={s.separador} />}
      ListHeaderComponent={<View style={{ gap: 14, marginBottom: 16 }}>
        <Text style={s.titulo}>Favoritos</Text>
        <CabeceraUsuario />
        <Text style={s.ayuda}>Tus eventos guardados por fecha, incluidos los comenzados y finalizados.</Text>
        <EstadoFavoritos favoritos={favoritos} />
      </View>}
      ListEmptyComponent={!favoritos.cargando && !favoritos.error && favoritos.datos?.length === 0 ? <View style={s.tarjeta}>
        <Text style={s.texto}>Todavía no guardaste eventos.</Text>
        <Boton titulo="Explorar el catálogo" secundario onPress={() => router.replace('/')} />
      </View> : undefined}
      renderItem={({ item }) => <TarjetaEvento evento={item} favoritos={favoritos} />} />
    <Pestañas activa="Favoritos" />
  </SafeAreaView>;
}
