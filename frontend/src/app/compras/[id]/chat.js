import { useCallback, useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { FlatList, KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSesion } from '../../../contexto/Sesion';
import { useChat } from '../../../hooks/useChat';
import { useConsulta } from '../../../hooks/useConsulta';
import { Aviso, Boton, Carga } from '../../../ui/Componentes';
import { colores, estilos as s, fecha } from '../../../ui/tema';

export default function Conversacion() {
  const { id } = /** @type {{id: string}} */ (useLocalSearchParams());
  const { usuario, baseUrl } = useSesion();
  if (!usuario) return <Redirect href="/usuarios" />;
  // Desmontar también el borrador al cambiar compra, usuario o backend.
  return <Chat key={`${baseUrl}:${usuario.id}:${id}`} id={id} usuario={usuario} />;
}

/** @param {{id: string, usuario: import('../../../api/tipos').Usuario}} props */
function Chat({ id, usuario }) {
  const { api } = useSesion();
  const [texto, setTexto] = useState('');
  const compra = useConsulta(useCallback((signal) => api.compra(id, signal), [api, id]));
  const chat = useChat(id);
  const mensajes = [...chat.mensajes.map((m) => ({ clave: m.id, texto: m.texto, autor: m.autor.nombre,
    propio: m.autor.id === usuario.id, fecha: m.fecha, estado: 'Enviado', error: '', idEnvio: m.idEnvio })),
  ...chat.pendientes.map((p) => ({ ...p, clave: `pendiente:${p.idEnvio}`, autor: usuario.nombre, propio: true, fecha: '' }))];
  return <SafeAreaView style={s.pagina}>
    <KeyboardAvoidingView style={s.pagina} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ padding: 16, gap: 6 }}>
        <Boton titulo="Volver a la compra" secundario onPress={() => router.dismissTo({ pathname: '/compras/[id]', params: { id } })} />
        <Text style={s.subtitulo}>{compra.datos?.evento.titulo ?? 'Conversación de la compra'}</Text>
        <Text style={s.ayuda}>{usuario.nombre} · {chat.conexion}</Text>
        <Carga consulta={compra} />
      </View>
      <FlatList style={{ flex: 1 }} data={mensajes} keyExtractor={(item) => item.clave} contentContainerStyle={s.contenido}
        keyboardShouldPersistTaps="handled" ItemSeparatorComponent={() => <View style={s.separador} />}
        ListHeaderComponent={<>
          <Text style={s.ayuda}>Entre comprador y organizador, incluso si la compra se cancela o reembolsa.</Text>
          <Aviso mensaje={chat.error} />
          {['Desconectado', 'Reconectando'].includes(chat.conexion) && <Boton titulo="Reconectar chat" secundario onPress={chat.reconectar} />}
        </>}
        ListEmptyComponent={chat.conexion === 'Conectado' ? <Text style={s.texto}>Todavía no hay mensajes. Iniciá la conversación.</Text> : undefined}
        renderItem={({ item }) => <View style={[s.tarjeta, { backgroundColor: item.propio ? '#E4ECF8' : colores.blanco }]}>
          <Text style={s.etiqueta}>{item.autor}{item.propio ? ' · Vos' : ''}</Text>
          <Text selectable style={s.texto}>{item.texto}</Text>
          <Text style={s.ayuda}>{item.fecha ? `${fecha(item.fecha)} · ` : ''}{item.estado}</Text>
          {!!item.error && <Text accessibilityRole="alert" style={s.error}>{item.error}</Text>}
          {item.estado === 'Error' && <Boton titulo="Reintentar mensaje" secundario disabled={chat.conexion !== 'Conectado'} onPress={() => chat.reintentar(item.idEnvio)} />}
        </View>} />
      <View style={{ padding: 16, gap: 10, backgroundColor: colores.blanco }}>
        <Text style={s.etiqueta}>Mensaje</Text>
        <TextInput accessibilityLabel="Mensaje" value={texto} onChangeText={setTexto} multiline style={[s.input, { maxHeight: 120 }]} placeholder="Escribí tu consulta o respuesta" />
        <Boton titulo="Enviar mensaje" disabled={!texto.trim() || chat.conexion !== 'Conectado'} onPress={() => { if (chat.enviar(texto)) setTexto(''); }} />
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
