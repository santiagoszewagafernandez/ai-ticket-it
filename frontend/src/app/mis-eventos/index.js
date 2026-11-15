import { useCallback } from 'react';
import { Redirect, router } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSesion } from '../../contexto/Sesion';
import { useConsulta } from '../../hooks/useConsulta';
import { Boton, Carga } from '../../ui/Componentes';
import { CabeceraUsuario, Pestañas } from '../../ui/Navegacion';
import { estilos as s, fecha } from '../../ui/tema';

export default function MisEventos() {
  const { usuario, api } = useSesion();
  const consulta = useConsulta(useCallback((signal) => api.misEventos(signal), [api]));
  if (!usuario) return <Redirect href="/usuarios" />;
  return <SafeAreaView edges={['top', 'left', 'right']} style={s.pagina}>
    <FlatList data={consulta.datos ?? []} keyExtractor={(evento) => evento.id} contentContainerStyle={s.contenido}
      refreshing={consulta.cargando} onRefresh={consulta.recargar} ItemSeparatorComponent={() => <View style={s.separador} />}
      ListHeaderComponent={<View style={{ gap: 14, marginBottom: 16 }}>
        <Text style={s.titulo}>Mis eventos</Text>
        <CabeceraUsuario />
        <Text style={s.ayuda}>Los eventos que organizás, incluidos los que ya comenzaron o finalizaron.</Text>
        <Boton titulo="Crear evento" onPress={() => router.push('/mis-eventos/nuevo')} />
        <Carga consulta={consulta} />
      </View>}
      ListEmptyComponent={!consulta.cargando && !consulta.error ? <Text style={s.texto}>Todavía no organizaste eventos. Creá el primero desde acá.</Text> : undefined}
      renderItem={({ item }) => <View style={s.tarjeta}>
        <Text style={s.etiqueta}>{item.categoria.nombre} · {item.tiempoEvento.etiqueta}</Text>
        <Text style={s.subtitulo}>{item.titulo}</Text>
        <Text style={s.ayuda}>{fecha(item.inicio)} · {item.lugar}</Text>
        <Boton titulo="Gestionar evento" secundario onPress={() => router.push({ pathname: '/mis-eventos/[id]', params: { id: item.id } })} />
      </View>} />
    <Pestañas activa="Mis eventos" />
  </SafeAreaView>;
}
