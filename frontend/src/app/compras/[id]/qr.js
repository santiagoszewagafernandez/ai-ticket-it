import { useCallback, useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSesion } from '../../../contexto/Sesion';
import { useConsulta } from '../../../hooks/useConsulta';
import { Boton, Carga } from '../../../ui/Componentes';
import { contenidoQR } from '../../../entradas/qr';
import { estilos as s, estadoTexto } from '../../../ui/tema';

export default function VisorQR() {
  const { id } = /** @type {{id: string}} */ (useLocalSearchParams());
  const { usuario, api } = useSesion();
  const consulta = useConsulta(useCallback((signal) => api.compra(id, signal), [api, id]));
  const [indice, setIndice] = useState(0);
  const { width } = useWindowDimensions();
  if (!usuario) return <Redirect href="/usuarios" />;
  const compra = consulta.datos;
  const entrada = compra?.entradas[indice];
  return <ScrollView style={s.pagina} contentContainerStyle={s.contenido}>
    <Carga consulta={consulta} />
    {compra && entrada && <>
      <Text style={s.titulo}>{compra.evento.titulo}</Text>
      <Text style={s.subtitulo}>{compra.tipoEntrada.nombre} · Entrada {indice + 1} de {compra.cantidad}</Text>
      <Text style={s.etiqueta}>{estadoTexto(entrada.estado)}</Text>
      <View style={{ alignItems: 'center', backgroundColor: 'white', padding: 16 }} accessibilityLabel={`QR de la entrada ${indice + 1} de ${compra.cantidad}`}>
        <QRCode value={contenidoQR(entrada.id)} size={Math.max(120, Math.min(280, width - 96))} quietZone={12} />
      </View>
      <Text selectable style={s.ayuda}>{entrada.id}</Text>
      <Text style={s.texto}>{entrada.estado !== 'SIN_UTILIZAR' ? 'Esta entrada no admite ingreso.' : !compra.pago ? 'Falta el pago aprobado para poder ingresar.' : 'Presentá este QR al organizador. Escanear solo consulta; el ingreso se registra al confirmar.'}</Text>
      <Boton titulo="Entrada anterior" secundario disabled={indice === 0} onPress={() => setIndice((i) => i - 1)} />
      <Boton titulo="Entrada siguiente" secundario disabled={indice >= compra.cantidad - 1} onPress={() => setIndice((i) => i + 1)} />
    </>}
  </ScrollView>;
}
