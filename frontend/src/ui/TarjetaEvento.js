import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Boton } from './Componentes';
import { BotonFavorito } from './Favoritos';
import { dinero, estilos as s, fecha } from './tema';

/** @param {{evento: import('../api/tipos').Evento, favoritos: ReturnType<import('../hooks/useFavoritos').useFavoritos>}} props */
export function TarjetaEvento({ evento, favoritos }) {
  return <View style={s.tarjeta}>
    <Text style={s.etiqueta}>{evento.categoria.nombre} · {evento.tiempoEvento.etiqueta}</Text>
    <Text style={s.subtitulo}>{evento.titulo}</Text>
    <Text style={s.ayuda}>{fecha(evento.inicio)} · {evento.lugar}</Text>
    <Text style={s.texto}>{evento.agotado ? 'Agotado' : `Desde ${dinero(evento.precioDesdeCentavos)}`}</Text>
    {!evento.puedeReservar && evento.tiempoEvento.situacion !== 'PROXIMO' && <Text style={s.ayuda}>La venta finalizó. Podés consultar el evento.</Text>}
    <Text style={s.ayuda}>{evento.organizador.nombre} · {evento.organizador.reputacion.puntaje === null ? 'Sin calificaciones' : `★ ${evento.organizador.reputacion.puntaje.toFixed(1)} (${evento.organizador.reputacion.cantidad})`}</Text>
    <Boton titulo="Ver evento" secundario onPress={() => router.push({ pathname: '/eventos/[id]', params: { id: evento.id } })} />
    <BotonFavorito eventoId={evento.id} favoritos={favoritos} />
  </View>;
}
