import { useCallback, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSesion } from '../../contexto/Sesion';
import { useConsulta } from '../../hooks/useConsulta';
import { Boton, Carga, Opcion } from '../../ui/Componentes';
import { CabeceraUsuario, Pestañas } from '../../ui/Navegacion';
import { estadoTexto, estilos as s, fecha } from '../../ui/tema';
import { ResumenCompra } from '../../ui/ResumenCompra';

export default function MisCompras() {
  const { usuario, api } = useSesion();
  const [estado, setEstado] = useState('');
  const consulta = useConsulta(useCallback((signal) => api.compras(estado, signal), [api, estado]));
  if (!usuario) return <Redirect href="/usuarios" />;
  return <SafeAreaView edges={['top', 'left', 'right']} style={s.pagina}>
    <FlatList data={consulta.datos ?? []} keyExtractor={(compra) => compra.id} contentContainerStyle={s.contenido}
      refreshing={consulta.cargando} onRefresh={consulta.recargar} ItemSeparatorComponent={() => <View style={s.separador} />}
      ListHeaderComponent={<View style={{ gap: 14, marginBottom: 16 }}>
        <Text style={s.titulo}>Mis compras</Text>
        <CabeceraUsuario />
        <Text style={s.ayuda}>Tus reservas y entradas, de más reciente a más antigua.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {['', 'PENDIENTE', 'CONFIRMADA', 'UTILIZADA', 'CANCELADA', 'REEMBOLSADA'].map((valor) => <Opcion key={valor} titulo={valor ? estadoTexto(valor) : 'Todas'} seleccionada={estado === valor} onPress={() => setEstado(valor)} />)}
        </ScrollView>
        <Carga consulta={consulta} />
      </View>}
      ListEmptyComponent={!consulta.cargando && !consulta.error ? <View style={s.tarjeta}><Text style={s.texto}>No tenés compras en este filtro.</Text><Boton titulo="Explorar el catálogo" onPress={() => router.replace('/')} secundario /></View> : undefined}
      renderItem={({ item }) => <View style={s.tarjeta}>
        <Text style={s.etiqueta}>{estadoTexto(item.estado)}</Text>
        <Text style={s.subtitulo}>{item.evento.titulo}</Text>
        <Text style={s.ayuda}>{fecha(item.evento.inicio)} · {item.tipoEntrada.nombre}</Text>
        <Text style={s.ayuda}>Reserva del {fecha(item.creacion)}</Text>
        <ResumenCompra compra={item} />
        {item.estado === 'CONFIRMADA' && <Text style={s.etiqueta}>{item.tiempoEvento.etiqueta}</Text>}
        {item.estado === 'PENDIENTE' && <Text style={s.ayuda}>Pagar antes de {fecha(item.vencimiento)}</Text>}
        <Boton titulo="Ver compra" secundario onPress={() => router.push({ pathname: '/compras/[id]', params: { id: item.id } })} />
        <Boton titulo="Abrir conversación" secundario onPress={() => router.push({ pathname: '/compras/[id]/chat', params: { id: item.id } })} />
      </View>} />
    <Pestañas activa="Mis compras" />
  </SafeAreaView>;
}
