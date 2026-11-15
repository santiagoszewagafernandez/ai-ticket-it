import { useCallback } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSesion } from '../../../contexto/Sesion';
import { useConsulta } from '../../../hooks/useConsulta';
import { useEnvio } from '../../../hooks/useEnvio';
import { Aviso, Boton, Carga } from '../../../ui/Componentes';
import { PlazoReserva } from '../../../ui/PlazoReserva';
import { dinero, estilos as s } from '../../../ui/tema';

export default function Pago() {
  const { id } = /** @type {{id: string}} */ (useLocalSearchParams());
  const { usuario, api } = useSesion();
  const consulta = useConsulta(useCallback((signal) => api.compra(id, signal), [api, id]));
  const envio = useEnvio();
  if (!usuario) return <Redirect href="/usuarios" />;
  const compra = consulta.datos;
  const esComprador = compra?.comprador.id === usuario.id;
  return <ScrollView style={s.pagina} contentContainerStyle={s.contenido}>
    <Carga consulta={consulta} />
    {compra && <>
      <Text style={s.titulo}>{compra.pago ? 'Pago aprobado' : 'Confirmá tu salida'}</Text>
      <View style={s.tarjeta}>
        <Text style={s.subtitulo}>{compra.evento.titulo}</Text>
        <Text style={s.texto}>{compra.cantidadActiva} entradas activas · {compra.cantidadCancelada} canceladas · {compra.tipoEntrada.nombre}</Text>
        <Text style={s.subtitulo}>{compra.pago ? `Pago original: ${dinero(compra.pago.importeCentavos)}` : `A pagar: ${dinero(compra.importeAPagarCentavos)}`}</Text>
        <Text style={s.ayuda}>Este es un pago de demostración. No se te cobrará dinero ni se pedirán datos de tarjeta.</Text>
        {!esComprador && <Text style={s.texto}>Solo el comprador puede realizar el pago.</Text>}
        {compra.puedePagar && esComprador && <PlazoReserva compra={compra} alVencer={consulta.recargar} />}
        <Aviso mensaje={envio.error} />
        {envio.incierto && <Text style={s.ayuda}>Podés consultar el estado o repetir el pago: si se registró, recuperaremos el mismo comprobante.</Text>}
        {compra.puedePagar && esComprador && <Boton titulo={envio.ocupado ? 'Procesando pago…' : 'Simular pago aprobado'} ocupado={envio.ocupado}
          onPress={() => envio.enviar((signal) => api.pagar(compra.id, signal), (pagada) => router.replace({ pathname: '/compras/[id]', params: { id: pagada.id } }))} />}
        {!compra.puedePagar && !compra.pago && <Text style={s.texto}>La reserva ya no admite pago. El cupo fue liberado.</Text>}
        {envio.error && <Boton titulo="Consultar estado de la compra" secundario onPress={consulta.recargar} disabled={envio.ocupado} />}
        <Boton titulo="Ver detalle de compra" secundario disabled={envio.ocupado} onPress={() => router.replace({ pathname: '/compras/[id]', params: { id: compra.id } })} />
      </View>
    </>}
  </ScrollView>;
}
