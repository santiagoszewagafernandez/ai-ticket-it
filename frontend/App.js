import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { consultarSalud } from './src/api/salud';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <PantallaConexion />
    </SafeAreaProvider>
  );
}

function PantallaConexion() {
  const [baseUrl, setBaseUrl] = useState(process.env.EXPO_PUBLIC_API_URL ?? '');
  const [resultado, setResultado] = useState({
    estado: 'inicial',
    datos: /** @type {Awaited<ReturnType<typeof consultarSalud>> | null} */ (null),
    mensaje: '',
  });
  const consulta = useRef(/** @type {AbortController | null} */ (null));
  const cargando = resultado.estado === 'cargando';

  useEffect(() => () => {
    const pendiente = consulta.current;
    consulta.current = null;
    pendiente?.abort();
  }, []);

  async function comprobarConexion() {
    if (consulta.current) return;
    const controller = new AbortController();
    consulta.current = controller;
    setResultado({ estado: 'cargando', datos: null, mensaje: '' });
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const datos = await consultarSalud(baseUrl, {
        signal: controller.signal,
        plataforma: Platform.OS,
      });
      if (consulta.current === controller) {
        setResultado({ estado: 'exito', datos, mensaje: '' });
      }
    } catch (error) {
      if (consulta.current === controller) {
        setResultado({
          estado: 'error',
          datos: null,
          mensaje: controller.signal.aborted
            ? 'La consulta superó los 8 segundos. Revisá la URL, la red Wi-Fi y que Express esté iniciado.'
            : error instanceof Error ? error.message : 'No se pudo consultar el servidor.',
        });
      }
    } finally {
      clearTimeout(timeout);
      if (consulta.current === controller) consulta.current = null;
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>AI TICKET IT · BLOQUE 1</Text>
          <Text style={styles.title}>Conectemos tu app</Text>
          <Text style={styles.description}>
            Consultá el servidor de tu PC desde este dispositivo.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label} nativeID="url-label">URL del backend</Text>
            <TextInput
              style={styles.input}
              value={baseUrl}
              onChangeText={(value) => {
                setBaseUrl(value);
                setResultado({ estado: 'inicial', datos: null, mensaje: '' });
              }}
              editable={!cargando}
              accessibilityLabel="URL del backend"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="http://IP-DE-TU-PC:3000"
              placeholderTextColor="#657386"
            />
            <Text style={styles.hint}>
              Usá la IP Wi-Fi de la PC. Ambos dispositivos deben estar en la misma red.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.button, (cargando || pressed) && styles.buttonPressed]}
              onPress={comprobarConexion}
              disabled={cargando}
              accessibilityRole="button"
              accessibilityState={{ disabled: cargando, busy: cargando }}
            >
              <Text style={styles.buttonText}>{cargando ? 'Consultando…' : 'Consultar servidor'}</Text>
            </Pressable>
          </View>

          <View style={styles.card} accessibilityLiveRegion="polite">
            {resultado.estado === 'inicial' && <Text style={styles.description}>Listo para comprobar la conexión.</Text>}
            {cargando && <View style={styles.loading}><ActivityIndicator color="#2054A5" /><Text>Esperando al servidor…</Text></View>}
            {resultado.estado === 'exito' && resultado.datos && <>
              <Text style={styles.success}>Conexión comprobada</Text>
              <Text style={styles.description}>El backend respondió:</Text>
              <Text selectable style={styles.response}>{JSON.stringify(resultado.datos, null, 2)}</Text>
            </>}
            {resultado.estado === 'error' && <>
              <Text style={styles.error} accessibilityRole="alert">No se pudo conectar</Text>
              <Text style={styles.description}>{resultado.mensaje}</Text>
              <Text style={styles.hint}>Corregí la dirección o la conexión y volvé a consultar.</Text>
            </>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F2F5FA' },
  content: { padding: 24, gap: 18 },
  eyebrow: { color: '#2054A5', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#17283E', fontSize: 30, fontWeight: '700' },
  description: { color: '#34465D', fontSize: 16, lineHeight: 24 },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, gap: 14 },
  label: { color: '#17283E', fontSize: 16, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#8797AB', borderRadius: 8, padding: 12, minHeight: 48, color: '#17283E', fontSize: 16 },
  hint: { color: '#4C5F75', fontSize: 14, lineHeight: 21 },
  button: { backgroundColor: '#2054A5', borderRadius: 8, padding: 16, minHeight: 48, alignItems: 'center' },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  success: { color: '#17663E', fontSize: 20, fontWeight: '700' },
  error: { color: '#A02121', fontSize: 20, fontWeight: '700' },
  response: { color: '#17283E', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13, lineHeight: 22 },
});
