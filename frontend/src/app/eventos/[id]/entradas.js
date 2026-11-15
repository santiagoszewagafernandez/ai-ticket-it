import { useCallback, useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSesion } from '../../../contexto/Sesion';
import { useConsulta } from '../../../hooks/useConsulta';
import { useEnvio } from '../../../hooks/useEnvio';
import { Aviso, Boton, Carga } from '../../../ui/Componentes';
import { colores, dinero, estilos as s } from '../../../ui/tema';

export default function ElegirEntradas() {
  const { id } = /** @type {{id: string}} */ (useLocalSearchParams());
  const { usuario, api } = useSesion();
  const [seleccion, setSeleccion] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const envio = useEnvio();
  const consulta = useConsulta(useCallback(async (signal) => {
    const [evento, tipos] = await Promise.all([api.evento(id, signal), api.tipos(id, signal)]);
    return { evento, tipos };
  }, [api, id]));
  if (!usuario) return <Redirect href="/usuarios" />;
  const datos = consulta.datos;
  const elegido = datos?.tipos.find((tipo) => tipo.id === seleccion) ?? (!seleccion ? datos?.tipos.find((tipo) => !tipo.agotado) : null);
  return <ScrollView style={s.pagina} contentContainerStyle={s.contenido}>
    <Carga consulta={consulta} />
    {datos && <>
      <Text style={s.titulo}>{datos.evento.titulo}</Text>
      <Text style={s.texto}>Elegí un tipo de entrada</Text>
      {datos.tipos.map((tipo) => <Pressable key={tipo.id} disabled={tipo.agotado || envio.ocupado} onPress={() => setSeleccion(tipo.id)}
        accessibilityRole="radio" accessibilityLabel={`${tipo.nombre}, ${dinero(tipo.precioCentavos)}, ${tipo.disponibles} disponibles`}
        accessibilityState={{ selected: elegido?.id === tipo.id, disabled: tipo.agotado || envio.ocupado }}
        style={[s.tarjeta, { borderWidth: 2, borderColor: elegido?.id === tipo.id ? colores.azul : 'transparent' }, tipo.agotado && { opacity: 0.6 }]}>
        <Text style={s.subtitulo}>{elegido?.id === tipo.id ? '◉ ' : '○ '}{tipo.nombre}</Text>
        <Text style={s.texto}>{tipo.descripcion}</Text>
        <Text style={s.etiqueta}>{dinero(tipo.precioCentavos)} · {tipo.agotado ? 'Agotado' : `${tipo.disponibles} disponibles`}</Text>
      </Pressable>)}
      <View style={s.tarjeta}>
        <Text style={s.subtitulo}>Cantidad</Text>
        <View style={s.fila}>
          <Boton titulo="−" secundario disabled={cantidad <= 1 || envio.ocupado} onPress={() => setCantidad((n) => n - 1)} />
          <Text style={s.subtitulo} accessibilityLabel={`Cantidad: ${cantidad}`}>{cantidad}</Text>
          <Boton titulo="+" secundario disabled={!elegido || cantidad >= elegido.disponibles || envio.ocupado} onPress={() => setCantidad((n) => n + 1)} />
        </View>
        <Text style={s.subtitulo}>Total: {elegido ? dinero(elegido.precioCentavos * cantidad) : 'Elegí un tipo'}</Text>
        <Text style={s.ayuda}>Reservamos tu cupo por hasta 5 minutos. Si el evento comienza antes, ese será el límite para pagar.</Text>
        {elegido && cantidad > elegido.disponibles && <Aviso mensaje={`Ahora quedan ${elegido.disponibles}. Bajá la cantidad o elegí otro tipo.`} />}
        <Aviso mensaje={envio.error} />
        {envio.incierto && <Text style={s.ayuda}>La respuesta no llegó. Revisá Mis compras antes de volver a reservar: la reserva podría haberse registrado.</Text>}
        <Boton titulo={envio.ocupado ? 'Reservando…' : 'Reservar'} ocupado={envio.ocupado}
          disabled={!elegido || cantidad > elegido.disponibles || !datos.evento.puedeReservar || envio.incierto}
          onPress={() => {
            if (!elegido) return;
            envio.enviar((signal) => api.reservar({ compradorId: usuario.id, eventoId: id, tipoEntradaId: elegido.id, cantidad }, signal),
              (compra) => router.replace({ pathname: '/compras/[id]', params: { id: compra.id } }));
          }} />
        {envio.error && !envio.incierto && <Boton titulo="Actualizar disponibilidad" secundario onPress={consulta.recargar} />}
        {envio.incierto && <Boton titulo="Revisar Mis compras" secundario onPress={() => router.replace('/compras')} />}
      </View>
    </>}
  </ScrollView>;
}
