import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SesionProvider, useSesion } from '../contexto/Sesion';
import { colores } from '../ui/tema';
import { FormularioEventoProvider } from '../contexto/FormularioEvento';

export default function Layout() {
  return <SafeAreaProvider><SesionProvider><StatusBar style="dark" /><Navegador /></SesionProvider></SafeAreaProvider>;
}

function Navegador() {
  const { usuario, baseUrl } = useSesion();
  return <FormularioEventoProvider key={`${usuario?.id ?? 'sin-usuario'}:${baseUrl}`}><Stack screenOptions={{ headerTintColor: colores.azul, contentStyle: { backgroundColor: colores.fondo } }}>
    <Stack.Screen name="index" options={{ title: 'Catálogo', headerShown: false }} />
    <Stack.Screen name="favoritos" options={{ title: 'Favoritos', headerShown: false }} />
    <Stack.Screen name="usuarios" options={{ title: 'Usuario de demostración' }} />
    <Stack.Screen name="conexion" options={{ title: 'Diagnóstico de conexión' }} />
    <Stack.Screen name="eventos/[id]/index" options={{ title: 'Evento' }} />
    <Stack.Screen name="eventos/[id]/entradas" options={{ title: 'Elegir entradas' }} />
    <Stack.Screen name="compras/index" options={{ title: 'Mis compras', headerShown: false }} />
    <Stack.Screen name="compras/[id]/index" options={{ title: 'Detalle de compra' }} />
    <Stack.Screen name="compras/[id]/pago" options={{ title: 'Pago simulado' }} />
    <Stack.Screen name="compras/[id]/qr" options={{ title: 'Tus entradas' }} />
    <Stack.Screen name="compras/[id]/resena" options={{ title: 'Reseña del evento' }} />
    <Stack.Screen name="mis-eventos/lector/[id]" options={{ title: 'Escanear entrada' }} />
    <Stack.Screen name="compras/[id]/chat" options={{ title: 'Conversación', headerShown: false }} />
    <Stack.Screen name="mis-eventos/index" options={{ title: 'Mis eventos', headerShown: false }} />
    <Stack.Screen name="mis-eventos/[id]" options={{ title: 'Gestión de evento' }} />
    <Stack.Screen name="mis-eventos/nuevo/index" options={{ title: 'Crear evento · 1 de 2' }} />
    <Stack.Screen name="mis-eventos/nuevo/tipos" options={{ title: 'Crear evento · 2 de 2' }} />
  </Stack></FormularioEventoProvider>;
}
