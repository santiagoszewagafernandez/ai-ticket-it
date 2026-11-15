import { useCallback, useEffect, useMemo, useState } from 'react';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AppState, Linking, ScrollView, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSesion } from '../../../contexto/Sesion';
import { useConsulta } from '../../../hooks/useConsulta';
import { LectorEntrada } from '../../../entradas/LectorEntrada';
import { Aviso, Boton, Carga } from '../../../ui/Componentes';
import { estilos as s, fecha } from '../../../ui/tema';

export default function PantallaLector() {
  const { id } = /** @type {{id: string}} */ (useLocalSearchParams());
  const { usuario, api } = useSesion();
  const evento = useConsulta(useCallback((signal) => api.evento(id, signal), [api, id]));
  const lector = useMemo(() => new LectorEntrada({
    validar: (entradaId, signal) => api.validarEntrada(entradaId, id, signal),
    usar: (entradaId, signal) => api.usarEntrada(entradaId, id, signal),
  }), [api, id]);
  const [resultado, setResultado] = useState(lector.estado);
  const [activa, setActiva] = useState(false);
  const [permiso, pedirPermiso, consultarPermiso] = useCameraPermissions();
  const [errorCamara, setErrorCamara] = useState('');
  const [camaraLista, setCamaraLista] = useState(false);
  const [intentoCamara, setIntentoCamara] = useState(0);
  useEffect(() => lector.suscribir(setResultado), [lector]);
  useFocusEffect(useCallback(() => {
    setActiva(true);
    const suscripcion = AppState.addEventListener('change', (estado) => {
      // El diálogo de permiso puede pasar por inactive sin abandonar la app.
      if (estado === 'background') { setActiva(false); setCamaraLista(false); lector.suspender(); }
      if (estado === 'active') { setActiva(true); void consultarPermiso(); }
    });
    return () => { setActiva(false); lector.suspender(); suscripcion.remove(); };
  }, [lector, consultarPermiso]));
  if (!usuario) return <Redirect href="/usuarios" />;
  const propio = evento.datos?.organizador.id === usuario.id;
  const ocupado = ['consultando', 'confirmando'].includes(resultado.fase);
  const datos = resultado.datos;
  return <ScrollView style={s.pagina} contentContainerStyle={s.contenido}>
    <Carga consulta={evento} />
    {evento.datos && !propio && <Aviso mensaje="Solo el organizador puede escanear entradas de este evento." />}
    {propio && <>
      <Text style={s.titulo}>{evento.datos?.titulo}</Text>
      <Text style={s.texto}>Escaneá una entrada. Revisá los datos antes de confirmar el ingreso.</Text>
      {!permiso && <Text style={s.ayuda}>Consultando permiso de cámara…</Text>}
      {permiso && !permiso.granted && <>
        <Text style={s.texto}>Necesitamos acceso a la cámara para leer el QR.</Text>
        <Boton titulo={permiso.canAskAgain ? 'Permitir cámara' : 'Abrir ajustes de cámara'} onPress={() => {
          if (!permiso.canAskAgain) { void Linking.openSettings().catch(() => setErrorCamara('No se pudieron abrir Ajustes. Revisá el acceso a cámara de Expo Go.')); return; }
          void pedirPermiso().then((respuesta) => { if (respuesta.granted) { setActiva(true); setCamaraLista(false); } })
            .catch(() => setErrorCamara('No se pudo consultar el permiso. Revisá el acceso a cámara de Expo Go en Ajustes.'));
        }} />
      </>}
      {permiso?.granted && resultado.fase === 'leyendo' && <>
        <Text style={s.ayuda}>{camaraLista ? 'Cámara lista. Apuntá al QR.' : 'Preparando cámara…'}</Text>
        {activa && !errorCamara && <View style={{ height: 320, width: '100%', backgroundColor: '#17283E' }}>
          <CameraView key={intentoCamara} style={{ flex: 1, width: '100%' }} facing="back" autofocus="on" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onCameraReady={() => setCamaraLista(true)}
            onBarcodeScanned={({ data }) => { void lector.escanear(data); }}
            onMountError={({ message }) => setErrorCamara(`No se pudo iniciar la cámara: ${message}`)} />
        </View>}
        <Boton titulo="Reactivar cámara" secundario onPress={() => { setErrorCamara(''); setCamaraLista(false); setActiva(true); setIntentoCamara((n) => n + 1); }} />
      </>}
      <Aviso mensaje={errorCamara || resultado.error} />
      {ocupado && <Text style={s.subtitulo}>{resultado.fase === 'confirmando' ? 'Confirmando ingreso…' : 'Consultando entrada…'}</Text>}
      {datos && <>
        <Text style={s.subtitulo}>{datos.comprador.nombre}</Text>
        <Text style={s.texto}>{datos.evento.titulo} · {datos.tipoEntrada.nombre}</Text>
        <Text style={s.texto}>Entrada {datos.numero} de {datos.cantidad}</Text>
        <Text selectable style={s.ayuda}>{datos.entrada.id}</Text>
      </>}
      {resultado.fase === 'validada' && <>
        <Text style={s.texto}>Entrada válida. Todavía no fue utilizada.</Text>
        <Boton titulo="Confirmar ingreso" onPress={() => { void lector.confirmar(); }} />
      </>}
      {resultado.fase === 'utilizada' && <Text accessibilityRole="alert" style={s.subtitulo}>Ingreso confirmado{datos?.entrada.uso ? ` · ${fecha(datos.entrada.uso.fecha)}` : ''}</Text>}
      {resultado.fase !== 'leyendo' && <Boton titulo="Escanear otra" secundario disabled={ocupado} onPress={() => { setCamaraLista(false); lector.otra(); }} />}
    </>}
  </ScrollView>;
}
