import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSesion } from '../contexto/Sesion';
import { useConsulta } from '../hooks/useConsulta';
import { normalizarUrl } from '../api/cliente';
import { Aviso, Boton, Carga } from '../ui/Componentes';
import { estilos as s } from '../ui/tema';

export default function Usuarios() {
  const { api, usuario, setUsuario, baseUrl, setBaseUrl } = useSesion();
  const [url, setUrl] = useState(baseUrl);
  const [error, setError] = useState('');
  const consulta = useConsulta(useCallback((signal) => api.usuarios(signal), [api]));
  return <KeyboardAvoidingView style={s.pagina} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
      <Text style={s.titulo}>Tu próxima salida</Text>
      <Text style={s.texto}>Elegí con quién vas a explorar. Son usuarios ficticios de demostración.</Text>
      <Carga consulta={consulta} />
      {consulta.datos?.map((persona) => <View key={persona.id} style={s.tarjeta}>
        <Text style={s.subtitulo}>{persona.nombre}</Text>
        <Boton titulo={usuario?.id === persona.id ? 'Continuar con este usuario' : 'Elegir usuario'} onPress={() => {
          setUsuario(persona);
          router.replace('/');
        }} />
      </View>)}
      <View style={s.tarjeta}>
        <Text style={s.subtitulo}>Conexión local</Text>
        <Text style={s.ayuda}>La PC y el iPhone deben estar en el mismo Wi-Fi.</Text>
        <Text style={s.texto}>URL del backend</Text>
        <TextInput value={url} onChangeText={setUrl} style={s.input} accessibilityLabel="URL del backend" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <Aviso mensaje={error} />
        <Boton titulo="Aplicar URL y volver a consultar" secundario onPress={() => {
          try {
            const validada = normalizarUrl(url);
            setError('');
            if (validada === baseUrl) consulta.recargar();
            else { setUsuario(null); setBaseUrl(validada); }
          } catch (err) { setError(err instanceof Error ? err.message : 'La URL no es válida.'); }
        }} />
        <Boton titulo="Comprobar servidor" secundario onPress={() => router.push('/conexion')} />
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}
