import { useCallback, useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { FlatList, ScrollView, Text, View } from 'react-native';
import { useSesion } from '../../contexto/Sesion';
import { useConsulta } from '../../hooks/useConsulta';
import { Boton, Carga, Opcion } from '../../ui/Componentes';
import { ResumenCompra } from '../../ui/ResumenCompra';
import { dinero, estadoTexto, estilos as s, fecha } from '../../ui/tema';

export default function GestionEvento() {
  const { id } = /** @type {{id: string}} */ (useLocalSearchParams());
  const { usuario, api } = useSesion();
  const [estado, setEstado] = useState('');
  const evento = useConsulta(useCallback((signal) => api.evento(id, signal), [api, id]));
  const tipos = useConsulta(useCallback((signal) => api.tipos(id, signal), [api, id]));
  const compras = useConsulta(useCallback((signal) => api.comprasEvento(id, estado, signal), [api, id, estado]));
  if (!usuario) return <Redirect href="/usuarios" />;
  const propio = evento.datos?.organizador.id === usuario.id;
  return <FlatList style={s.pagina} data={propio ? compras.datos ?? [] : []} keyExtractor={(compra) => compra.id} contentContainerStyle={s.contenido}
    refreshing={evento.cargando || tipos.cargando || compras.cargando} onRefresh={() => { evento.recargar(); tipos.recargar(); compras.recargar(); }}
    ItemSeparatorComponent={() => <View style={s.separador} />}
    ListHeaderComponent={<View style={{ gap: 16, marginBottom: 16 }}>
      <Carga consulta={evento} />
      {evento.datos && !propio && <Text style={s.error}>Solo el organizador puede gestionar este evento.</Text>}
      {propio && evento.datos && <>
        <Text style={s.etiqueta}>{evento.datos.tiempoEvento.etiqueta} · Organiza {usuario.nombre}</Text>
        <Text style={s.titulo}>{evento.datos.titulo}</Text>
        <Text style={s.texto}>Inicio: {fecha(evento.datos.inicio)}</Text>
        <Text style={s.texto}>Fin: {fecha(evento.datos.fin)}</Text>
        {!!evento.datos.lugar && <Text style={s.ayuda}>{evento.datos.lugar}</Text>}
        <Boton titulo="Escanear entrada" onPress={() => router.push({ pathname: '/mis-eventos/lector/[id]', params: { id } })} />
        <Boton titulo="Ver evento" secundario onPress={() => router.push({ pathname: '/eventos/[id]', params: { id } })} />
        <Text style={s.subtitulo}>Disponibilidad por tipo</Text>
        <Carga consulta={tipos} />
        {tipos.datos?.map((tipo) => <View key={tipo.id} style={s.tarjeta}>
          <Text style={s.subtitulo}>{tipo.nombre}</Text>
          <Text style={s.texto}>{tipo.disponibles} disponibles de {tipo.cupo} · {dinero(tipo.precioCentavos)}</Text>
          <Text style={s.ayuda}>{tipo.agotado ? 'Agotado' : 'Las reservas vigentes y las ventas ocupan cupo.'}</Text>
        </View>)}
        <Text style={s.subtitulo}>Compras del evento</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {['', 'PENDIENTE', 'CONFIRMADA', 'UTILIZADA', 'CANCELADA', 'REEMBOLSADA'].map((valor) => <Opcion key={valor} titulo={valor ? estadoTexto(valor) : 'Todas'} seleccionada={estado === valor} onPress={() => setEstado(valor)} />)}
        </ScrollView>
        <Carga consulta={compras} />
      </>}
    </View>}
    ListEmptyComponent={propio && !compras.cargando && !compras.error ? <Text style={s.texto}>No hay compras en este filtro.</Text> : undefined}
    ListFooterComponent={<View style={{ gap: 12, marginTop: 16 }}>
      <Boton titulo="Ver Mis eventos" secundario onPress={() => router.replace('/mis-eventos')} />
      <Boton titulo="Ir al catálogo" secundario onPress={() => router.replace('/')} />
    </View>}
    renderItem={({ item }) => <View style={s.tarjeta}>
      <Text style={s.etiqueta}>{estadoTexto(item.estado)}</Text>
      <Text style={s.subtitulo}>{item.comprador.nombre}</Text>
      <Text style={s.texto}>{item.tipoEntrada.nombre}</Text>
      <ResumenCompra compra={item} />
      <Text style={s.ayuda}>{fecha(item.creacion)}</Text>
      <Boton titulo="Ver detalle de compra" secundario onPress={() => router.push({ pathname: '/compras/[id]', params: { id: item.id } })} />
      <Boton titulo="Abrir conversación" secundario onPress={() => router.push({ pathname: '/compras/[id]/chat', params: { id: item.id } })} />
    </View>} />;
}
