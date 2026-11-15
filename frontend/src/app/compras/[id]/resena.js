import { useCallback, useState } from 'react';
import { Redirect, router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSesion } from '../../../contexto/Sesion';
import { useConsulta } from '../../../hooks/useConsulta';
import { useEnvio } from '../../../hooks/useEnvio';
import { prepararResena } from '../../../formularios/resena';
import { Aviso, Boton, Carga } from '../../../ui/Componentes';
import { Campo } from '../../../ui/Campo';
import { TuResena } from '../../../ui/TuResena';
import { estilos as s, colores } from '../../../ui/tema';

export default function PantallaResena() {
  const { id } = /** @type {{id: string}} */ (useLocalSearchParams());
  const { usuario, api } = useSesion();
  const consulta = useConsulta(useCallback((signal) => api.compra(id, signal), [api, id]));
  const envio = useEnvio();
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState('');
  const [publicada, setPublicada] = useState(/** @type {import('../../../api/tipos').Resena | null} */ (null));
  usePreventRemove(envio.ocupado);
  if (!usuario) return <Redirect href="/usuarios" />;
  const compra = consulta.datos;
  const propia = publicada ?? compra?.resena.propia;
  const esComprador = compra?.comprador.id === usuario.id;
  return <KeyboardAvoidingView style={s.pagina} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
      <Carga consulta={consulta} />
      {compra && <>
        <Text style={s.titulo}>{compra.evento.titulo}</Text>
        {!esComprador && <Aviso mensaje="Solo el comprador puede publicar su reseña." />}
        {esComprador && propia && <TuResena resena={propia} />}
        {esComprador && !propia && !compra.resena.puedePublicar && <Text style={s.texto}>{compra.resena.motivo}</Text>}
        {esComprador && !propia && compra.resena.puedePublicar && <>
          <Text style={s.subtitulo}>¿Cómo fue tu experiencia?</Text>
          <Text style={s.texto}>{puntaje ? `${puntaje} de 5 estrellas` : 'Elegí de 1 a 5 estrellas'}</Text>
          <View style={[s.fila, { gap: 4 }]} accessibilityRole="radiogroup">
            {[1, 2, 3, 4, 5].map((valor) => <Pressable key={valor} disabled={envio.ocupado} accessibilityRole="radio"
              accessibilityLabel={`${valor} ${valor === 1 ? 'estrella' : 'estrellas'}`}
              accessibilityState={{ selected: puntaje === valor, disabled: envio.ocupado }} onPress={() => setPuntaje(valor)}
              style={{ minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 32, color: colores.azul }}>{valor <= puntaje ? '★' : '☆'}</Text>
            </Pressable>)}
          </View>
          <Campo etiqueta="Comentario" multiline value={comentario} onChangeText={setComentario} editable={!envio.ocupado} />
          <Aviso mensaje={envio.error} />
          {envio.incierto && <Text style={s.ayuda}>La respuesta no llegó. Consultá tu reseña antes de volver a publicar; no se envía automáticamente.</Text>}
          <Boton titulo={envio.ocupado ? 'Publicando…' : 'Publicar reseña'} ocupado={envio.ocupado} disabled={envio.incierto || !puntaje || !comentario.trim()}
            onPress={() => envio.enviar((signal) => api.publicarResena(compra.evento.id, prepararResena(puntaje, comentario), signal), (resena) => { setPublicada(resena); consulta.recargar(); })} />
        </>}
        {!propia && <Boton titulo="Consultar tu reseña" secundario disabled={envio.ocupado} onPress={() => envio.enviar((signal) => api.compra(id, signal), (actual) => {
          setPublicada(actual.resena.propia); consulta.recargar();
        })} />}
        <Boton titulo="Volver a la compra" secundario disabled={envio.ocupado} onPress={() => router.dismissTo({ pathname: '/compras/[id]', params: { id } })} />
        <Boton titulo="Ver evento y reputación" secundario disabled={envio.ocupado} onPress={() => router.push({ pathname: '/eventos/[id]', params: { id: compra.evento.id } })} />
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
