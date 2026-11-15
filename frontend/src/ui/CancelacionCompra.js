import { useState } from 'react';
import { usePreventRemove } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSesion } from '../contexto/Sesion';
import { useEnvio } from '../hooks/useEnvio';
import { alternarEntrada, resumenCancelacion } from '../formularios/cancelacion';
import { Aviso, Boton } from './Componentes';
import { colores, dinero, estadoTexto, estilos as s, fecha } from './tema';

/** Siempre montado durante una recarga para conservar la selección, incluso tras errores.
 * @param {{compra: import('../api/tipos').Compra | null, recargar: () => void, alOcupar: (ocupado: boolean) => void}} props
 */
export function CancelacionCompra({ compra, recargar, alOcupar }) {
  const { usuario, api } = useSesion();
  const envio = useEnvio();
  const [modo, setModo] = useState(false);
  const [seleccion, setSeleccion] = useState(/** @type {string[]} */ ([]));
  const [exito, setExito] = useState('');
  usePreventRemove(envio.ocupado);
  if (!compra) return null;
  const propia = compra.comprador.id === usuario?.id;
  const resumen = resumenCancelacion(compra, seleccion);
  function confirmar() {
    if (!compra || !seleccion.length || resumen.invalida) return;
    alOcupar(true);
    void envio.enviar((signal) => api.cancelar(compra.id, seleccion, signal), (actual) => {
      setExito(actual.pago ? `Cancelación confirmada. Reembolso simulado acumulado: ${dinero(actual.importeReembolsadoCentavos)}.` : 'Cancelación confirmada. Cupo liberado sin devolución de dinero.');
      setSeleccion([]);
      setModo(false);
      recargar();
    }).finally(() => alOcupar(false));
  }
  return <View style={s.tarjeta}>
    <Text style={s.subtitulo}>Entradas individuales</Text>
    {!!exito && <Text style={s.etiqueta} accessibilityLiveRegion="polite">{exito}</Text>}
    {propia && <Text style={s.ayuda}>Cancelación hasta {fecha(compra.limiteCancelacion)}, inclusive: una hora antes del inicio.</Text>}
    {propia && !modo && compra.puedeCancelar && <Boton titulo="Seleccionar entradas para cancelar" secundario onPress={() => { setModo(true); setExito(''); }} />}
    {propia && !compra.puedeCancelar && <Text style={s.ayuda}>No hay entradas cancelables en este momento: revisá sus estados y el plazo.</Text>}
    {compra.entradas.map((entrada, i) => {
      const marcada = seleccion.includes(entrada.id);
      const deshabilitada = envio.ocupado || (entrada.estado !== 'SIN_UTILIZAR' && !marcada);
      return <View key={entrada.id} style={{ gap: 3 }}>
        {modo && propia ? <Pressable accessibilityRole="checkbox" accessibilityLabel={`Entrada ${i + 1}, ${estadoTexto(entrada.estado)}`}
          accessibilityState={{ checked: marcada, disabled: deshabilitada }} disabled={deshabilitada}
          onPress={() => setSeleccion((actual) => alternarEntrada(actual, entrada.id))}
          style={[s.input, marcada && { borderColor: colores.azul, borderWidth: 2, backgroundColor: '#E4ECF8' }, deshabilitada && { opacity: 0.55 }]}>
          <Text style={s.texto}>{marcada ? '☑' : '☐'} Entrada {i + 1} · {estadoTexto(entrada.estado)}</Text>
        </Pressable> : <Text style={s.texto}>Entrada {i + 1} · {estadoTexto(entrada.estado)}</Text>}
        <Text selectable style={s.ayuda}>{entrada.id}</Text>
      </View>;
    })}
    {modo && propia && <>
      <Text style={s.subtitulo}>{resumen.cantidad} entradas seleccionadas</Text>
      <Text style={s.texto}>{compra.pago ? `Reembolso simulado estimado: ${dinero(resumen.importeReembolsoCentavos)}` : `Importe que dejarías de pagar: ${dinero(resumen.importeLiberadoCentavos)}`}</Text>
      <Text style={s.ayuda}>{compra.pago ? 'Se devolverá el cupo seleccionado y su importe pagado. El comprobante original se conserva.' : 'Se libera el cupo seleccionado sin devolución de dinero. Después podés pagar solo las restantes dentro del plazo de reserva.'}</Text>
      {resumen.invalida && <Text style={s.error}>Una entrada seleccionada ya no es cancelable. Desmarcala para corregir la selección.</Text>}
      <Aviso mensaje={envio.error} />
      {envio.error && <Text style={s.ayuda}>Conservamos tu selección. Revisá el estado actualizado y ajustala antes de confirmar.</Text>}
      {envio.incierto && <Text style={s.ayuda}>La respuesta no llegó: consultá el estado antes de repetir. Una cancelación ya registrada no devuelve cupo ni dinero nuevamente.</Text>}
      <Boton titulo={envio.ocupado ? 'Cancelando entradas…' : 'Confirmar cancelación'} ocupado={envio.ocupado}
        disabled={!resumen.cantidad || resumen.invalida || !compra.puedeCancelar} onPress={confirmar} />
      <Boton titulo="Actualizar estado sin borrar selección" secundario disabled={envio.ocupado} onPress={recargar} />
      <Boton titulo="Salir de selección" secundario disabled={envio.ocupado} onPress={() => setModo(false)} />
    </>}
  </View>;
}
