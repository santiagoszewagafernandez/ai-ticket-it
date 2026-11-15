import { useCallback } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSesion } from '../../../contexto/Sesion';
import { useConsulta } from '../../../hooks/useConsulta';
import { Boton, Carga } from '../../../ui/Componentes';
import { Multimedia } from '../../../ui/Multimedia';
import { dinero, estilos as s, fecha } from '../../../ui/tema';
import { useFavoritos } from '../../../hooks/useFavoritos';
import { BotonFavorito, EstadoFavoritos } from '../../../ui/Favoritos';

export default function DetalleEvento() {
  const { id } = /** @type {{id: string}} */ (useLocalSearchParams());
  const { usuario, api } = useSesion();
  const favoritos = useFavoritos();
  const consulta = useConsulta(useCallback(async (signal) => {
    const evento = await api.evento(id, signal);
    const resenas = await api.resenas(evento.organizador.id, signal);
    return { evento, resenas };
  }, [api, id]));
  if (!usuario) return <Redirect href="/usuarios" />;
  const evento = consulta.datos?.evento;
  return <ScrollView style={s.pagina} contentContainerStyle={s.contenido}>
    <Carga consulta={consulta} />
    {evento && <>
      <Text style={s.etiqueta}>{evento.categoria.nombre} · {evento.tiempoEvento.etiqueta}</Text>
      <Text style={s.titulo}>{evento.titulo}</Text>
      <EstadoFavoritos favoritos={favoritos} />
      <BotonFavorito eventoId={evento.id} favoritos={favoritos} />
      <Multimedia medios={evento.multimedia} titulo={evento.titulo} />
      <View style={s.tarjeta}>
        <Text style={s.texto}>{fecha(evento.inicio)} a {fecha(evento.fin)}</Text>
        <Text style={s.ayuda}>{evento.lugar} · Horario de Buenos Aires</Text>
        <Text style={s.texto}>{evento.descripcion}</Text>
        <Text style={s.subtitulo}>{evento.agotado ? 'Agotado' : `Desde ${dinero(evento.precioDesdeCentavos)}`}</Text>
        {evento.tiempoEvento.situacion === 'EN_CURSO' && <Text style={s.ayuda}>El evento está en curso. Ya no admite nuevas compras.</Text>}
        <Boton titulo={evento.tiempoEvento.situacion === 'EN_CURSO' ? 'Venta cerrada: evento en curso' : evento.tiempoEvento.situacion === 'FINALIZADO' ? 'Venta cerrada: evento finalizado' : evento.agotado ? 'Entradas agotadas' : 'Elegir entradas'} disabled={!evento.puedeReservar}
          onPress={() => router.push({ pathname: '/eventos/[id]/entradas', params: { id: evento.id } })} />
      </View>
      <View style={s.tarjeta}>
        <Text style={s.etiqueta} accessibilityRole="header">Organizador</Text>
        <Text style={s.subtitulo}>{evento.organizador.nombre}</Text>
      </View>
      <View style={{ gap: 12, marginTop: 8 }}>
        <Text style={s.subtitulo} accessibilityRole="header">Reseñas de asistentes</Text>
        <Text style={s.ayuda}>Opiniones sobre eventos de {evento.organizador.nombre}.</Text>
        <View style={[s.tarjeta, { backgroundColor: '#E4ECF8' }]}>
          <Text style={s.etiqueta}>Calificación general del organizador</Text>
          <Text style={s.subtitulo}>{evento.organizador.reputacion.puntaje === null ? 'Sin calificaciones' : `★ ${evento.organizador.reputacion.puntaje.toFixed(1)} de 5`}</Text>
          {evento.organizador.reputacion.cantidad > 0 && <Text style={s.ayuda}>
            {evento.organizador.reputacion.cantidad} {evento.organizador.reputacion.cantidad === 1 ? 'reseña' : 'reseñas'} de asistentes
          </Text>}
        </View>
        {consulta.datos?.resenas.map((resena) => <View key={resena.id} style={s.tarjeta}>
          <Text style={s.etiqueta}>Reseña de {resena.comprador.nombre}</Text>
          <Text style={s.texto}>★ {resena.puntaje} de 5</Text>
          <Text style={s.texto}>{resena.comentario}</Text>
          <Text style={s.ayuda}>Evento: {resena.evento.titulo}</Text>
        </View>)}
        {consulta.datos?.resenas.length === 0 && <Text style={s.texto}>Todavía no hay reseñas de asistentes.</Text>}
      </View>
    </>}
  </ScrollView>;
}
