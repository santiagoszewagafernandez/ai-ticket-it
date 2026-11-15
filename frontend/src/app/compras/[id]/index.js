import { useCallback, useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSesion } from '../../../contexto/Sesion';
import { useConsulta } from '../../../hooks/useConsulta';
import { Boton, Carga } from '../../../ui/Componentes';
import { PlazoReserva } from '../../../ui/PlazoReserva';
import { ResumenCompra } from '../../../ui/ResumenCompra';
import { CancelacionCompra } from '../../../ui/CancelacionCompra';
import { TuResena } from '../../../ui/TuResena';
import { dinero, estadoTexto, estilos as s, fecha } from '../../../ui/tema';

export default function DetalleCompra() {
  const { id } = /** @type {{id: string}} */ (useLocalSearchParams());
  const { usuario, api, baseUrl } = useSesion();
  const [cancelando, setCancelando] = useState(false);
  const consulta = useConsulta(useCallback((signal) => api.compra(id, signal), [api, id]));
  if (!usuario) return <Redirect href="/usuarios" />;
  const compra = consulta.datos;
  return <ScrollView style={s.pagina} contentContainerStyle={s.contenido}>
    <Carga consulta={consulta} />
    {compra && <>
      <Text style={s.etiqueta}>{estadoTexto(compra.estado)}</Text>
      <Text style={s.titulo}>{compra.evento.titulo}</Text>
      <Text style={s.ayuda}>Comprador: {compra.comprador.nombre}</Text>
      <Boton titulo="Abrir conversación" secundario disabled={cancelando} onPress={() => router.push({ pathname: '/compras/[id]/chat', params: { id: compra.id } })} />
      {compra.comprador.id === usuario.id && <Boton titulo="Ver entradas con QR" secundario disabled={cancelando} onPress={() => router.push({ pathname: '/compras/[id]/qr', params: { id: compra.id } })} />}
      {compra.comprador.id === usuario.id && <>
        {compra.resena.propia ? <TuResena resena={compra.resena.propia} /> : <Text style={s.ayuda}>{compra.resena.motivo || 'Ya podés compartir tu experiencia.'}</Text>}
        <Boton titulo={compra.resena.propia ? 'Ver Tu reseña' : 'Escribir reseña'} secundario disabled={cancelando || (!compra.resena.propia && !compra.resena.puedePublicar)}
          onPress={() => router.push({ pathname: '/compras/[id]/resena', params: { id: compra.id } })} />
      </>}
      <Text style={s.ayuda}>{fecha(compra.evento.inicio)} · {compra.evento.lugar}</Text>
      {compra.estado === 'CONFIRMADA' && <Text style={s.subtitulo}>{compra.tiempoEvento.etiqueta}</Text>}
      <View style={s.tarjeta}>
        <Text style={s.subtitulo}>{compra.tipoEntrada.nombre} · {compra.cantidad} entradas</Text>
        <Text style={s.texto}>Precio acordado: {dinero(compra.precioUnitarioCentavos)} por entrada</Text>
        <ResumenCompra compra={compra} />
        <Text selectable style={s.ayuda}>Compra: {compra.id}</Text>
        {compra.puedePagar && compra.comprador.id === usuario.id && <>
          <PlazoReserva compra={compra} alVencer={consulta.recargar} />
          <Text style={s.ayuda}>Tu cupo está reservado hasta {fecha(compra.vencimiento)}. El pago es simulado.</Text>
          <Boton titulo="Ir al pago" disabled={cancelando} onPress={() => router.push({ pathname: '/compras/[id]/pago', params: { id: compra.id } })} />
        </>}
        {compra.vencida && <Text style={s.texto}>La reserva venció sin pago. El cupo fue liberado.</Text>}
        {compra.pago && <>
          <Text style={s.etiqueta}>Pago simulado aprobado</Text>
          <Text style={s.texto}>{dinero(compra.pago.importeCentavos)} · {fecha(compra.pago.fecha)}</Text>
          <Text selectable style={s.ayuda}>Pago: {compra.pago.id}</Text>
        </>}
      </View>
    </>}
    <CancelacionCompra key={`${baseUrl}:${usuario.id}:${id}`} compra={compra} recargar={consulta.recargar} alOcupar={setCancelando} />
    {compra && <>
      <View style={s.tarjeta}>
        <Text style={s.subtitulo}>Historial de la compra</Text>
        {compra.historial.map((cambio) => <View key={cambio.id} style={{ gap: 3 }}>
          <Text style={s.texto}>{estadoTexto(cambio.estado)} · {fecha(cambio.fecha)}</Text>
          <Text style={s.ayuda}>{cambio.actor === 'SISTEMA' ? 'Automático: vencimiento de la reserva' : cambio.motivo === 'RESERVA' ? 'Reserva creada' : cambio.motivo === 'PAGO_SIMULADO' ? 'Pago simulado aprobado' : cambio.motivo === 'CANCELACION_COMPRADOR' ? 'Cancelación del comprador' : cambio.motivo === 'INGRESO' ? 'Ingreso confirmado por el organizador' : 'Asistencia histórica de demostración'}</Text>
        </View>)}
      </View>
      <Boton titulo="Ver evento" secundario disabled={cancelando} onPress={() => router.push({ pathname: '/eventos/[id]', params: { id: compra.evento.id } })} />
      {compra.comprador.id === usuario.id
        ? <Boton titulo="Ver Mis compras" disabled={cancelando} onPress={() => router.replace('/compras')} />
        : <Boton titulo="Volver a gestión del evento" disabled={cancelando} onPress={() => router.dismissTo({ pathname: '/mis-eventos/[id]', params: { id: compra.evento.id } })} />}
    </>}
  </ScrollView>;
}
