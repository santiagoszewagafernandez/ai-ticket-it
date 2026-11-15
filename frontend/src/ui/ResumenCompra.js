import { Text, View } from 'react-native';
import { dinero, estilos as s } from './tema';

/** @param {{compra: import('../api/tipos').Compra}} props */
export function ResumenCompra({ compra }) {
  return <View style={{ gap: 4 }}>
    <Text style={s.texto}>{compra.cantidadActiva} activas · {compra.cantidadCancelada} canceladas · {compra.cantidad} originales</Text>
    <Text style={s.ayuda}>Importe original: {dinero(compra.totalCentavos)}</Text>
    {compra.pago ? <>
      <Text style={s.texto}>Pago original: {dinero(compra.pago.importeCentavos)}</Text>
      <Text style={s.texto}>Reembolso simulado: {dinero(compra.importeReembolsadoCentavos)}</Text>
      <Text style={s.etiqueta}>Neto pagado: {dinero(compra.importeNetoCentavos)}</Text>
    </> : <Text style={s.etiqueta}>A pagar: {dinero(compra.importeAPagarCentavos)}</Text>}
  </View>;
}
