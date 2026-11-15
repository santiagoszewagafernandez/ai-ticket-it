import { useEffect, useState } from 'react';
import { AppState, Image, Text, View } from 'react-native';
import { useEvent } from 'expo';
import { useIsFocused } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { estilos as s } from './tema';
import { Boton } from './Componentes';

/** @param {{url: string}} props */
function Video({ url }) {
  const enfocada = useIsFocused();
  const [estadoApp, setEstadoApp] = useState(AppState.currentState);
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', setEstadoApp);
    return () => suscripcion.remove();
  }, []);
  // Desmontar libera el player mediante useVideoPlayer: no queda audio de otra pantalla.
  return enfocada && estadoApp === 'active'
    ? <Reproductor key={`${url}:${intento}`} url={url} reintentar={() => setIntento((n) => n + 1)} />
    : <Text style={s.ayuda}>Video pausado.</Text>;
}

/** @param {{url: string, reintentar: () => void}} props */
function Reproductor({ url, reintentar }) {
  const player = useVideoPlayer(url);
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  return <View style={{ gap: 8 }}>
    {status === 'error' ? <>
      <Text style={s.ayuda} accessibilityRole="alert">El video no está disponible. Podés continuar con el evento.</Text>
      <Boton titulo="Volver a cargar video" secundario onPress={reintentar} />
    </> : <>
      {(status === 'loading' || status === 'idle') && <Text style={s.ayuda}>Cargando video…</Text>}
      <VideoView player={player} nativeControls style={{ width: '100%', height: 210 }} accessibilityLabel="Video del evento" />
    </>}
  </View>;
}

/** @param {{url: string, titulo: string}} props */
function Imagen({ url, titulo }) {
  const [error, setError] = useState(false);
  return error ? <Text style={s.ayuda}>La imagen no está disponible. Podés continuar con la reserva.</Text>
    : <Image source={{ uri: url }} style={{ width: '100%', height: 200, borderRadius: 12 }} resizeMode="cover" accessibilityLabel={`Imagen de ${titulo}`} onError={() => setError(true)} />;
}

/** @param {{medios: {tipo: string, url: string}[], titulo: string}} props */
export function Multimedia({ medios, titulo }) {
  return <View style={{ gap: 12 }}>{medios.map((medio) => medio.tipo === 'video'
    ? <Video key={medio.url} url={medio.url} />
    : <Imagen key={medio.url} url={medio.url} titulo={titulo} />)}</View>;
}
