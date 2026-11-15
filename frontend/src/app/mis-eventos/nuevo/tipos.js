import { useState } from 'react';
import { Redirect, router, Stack } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSesion } from '../../../contexto/Sesion';
import { useFormularioEvento } from '../../../contexto/FormularioEvento';
import { altaEvento, tipoVacio } from '../../../formularios/evento';
import { useEnvio } from '../../../hooks/useEnvio';
import { Aviso, Boton } from '../../../ui/Componentes';
import { Campo } from '../../../ui/Campo';
import { estilos as s } from '../../../ui/tema';

export default function TiposEvento() {
  const { usuario, api } = useSesion();
  const { formulario: f, setFormulario, limpiar } = useFormularioEvento();
  const [error, setError] = useState('');
  const envio = useEnvio();
  /** @param {number} indice @param {keyof import('../../../formularios/evento').TipoFormulario} campo @param {string} valor */
  const cambiar = (indice, campo, valor) => setFormulario((actual) => ({ ...actual, tiposEntrada: actual.tiposEntrada.map((tipo, i) => i === indice ? { ...tipo, [campo]: valor } : tipo) }));
  if (!usuario) return <Redirect href="/usuarios" />;
  function crear() {
    if (!usuario) return;
    try {
      const conjunto = altaEvento(f, usuario.id);
      setError('');
      envio.enviar((signal) => api.crearEvento(conjunto, signal), (evento) => {
        limpiar();
        router.dismissTo('/mis-eventos');
        router.push({ pathname: '/mis-eventos/[id]', params: { id: evento.id } });
      });
    } catch (err) { setError(err instanceof Error ? err.message : 'Revisá los tipos.'); }
  }
  return <KeyboardAvoidingView style={s.pagina} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={96}>
    <Stack.Screen options={{ gestureEnabled: !envio.ocupado, headerBackVisible: !envio.ocupado }} />
    <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text style={s.etiqueta}>Paso 2 de 2 · {f.titulo || 'Nuevo evento'}</Text>
      <Text style={s.titulo}>Tipos de entrada</Text>
      <Text style={s.ayuda}>El evento y todos sus tipos se crean juntos. Precios en pesos argentinos; se admite cero para entradas gratuitas.</Text>
      {f.tiposEntrada.map((tipo, i) => <View key={i} style={s.tarjeta}>
        <Text style={s.subtitulo}>Tipo {i + 1}</Text>
        <Campo etiqueta={`Nombre del tipo ${i + 1}`} value={tipo.nombre} editable={!envio.ocupado} onChangeText={(valor) => cambiar(i, 'nombre', valor)} />
        <Campo etiqueta={`Descripción del tipo ${i + 1}`} value={tipo.descripcion} editable={!envio.ocupado} multiline onChangeText={(valor) => cambiar(i, 'descripcion', valor)} />
        <Campo etiqueta={`Precio del tipo ${i + 1} · ARS`} placeholder="12500,00" value={tipo.precio} editable={!envio.ocupado} keyboardType="decimal-pad" onChangeText={(valor) => cambiar(i, 'precio', valor)} />
        <Campo etiqueta={`Cupo del tipo ${i + 1}`} placeholder="10" value={tipo.cupo} editable={!envio.ocupado} keyboardType="number-pad" onChangeText={(valor) => cambiar(i, 'cupo', valor)} />
        {f.tiposEntrada.length > 1 && <Boton titulo={`Quitar tipo ${i + 1}`} secundario disabled={envio.ocupado} onPress={() => setFormulario((actual) => ({ ...actual, tiposEntrada: actual.tiposEntrada.filter((_, indice) => indice !== i) }))} />}
      </View>)}
      <Boton titulo="Agregar otro tipo" secundario disabled={envio.ocupado} onPress={() => setFormulario((actual) => ({ ...actual, tiposEntrada: [...actual.tiposEntrada, tipoVacio()] }))} />
      <Aviso mensaje={error || envio.error} />
      {envio.incierto && <View style={s.tarjeta}>
        <Text style={s.texto}>No se pudo confirmar la respuesta. Revisá Mis eventos antes de volver a crear: el servidor podría haberlo registrado. Conservamos el formulario.</Text>
        <Boton titulo="Revisar Mis eventos" secundario onPress={() => router.push('/mis-eventos')} />
      </View>}
      <Boton titulo={envio.ocupado ? 'Creando evento…' : 'Crear evento'} ocupado={envio.ocupado} onPress={crear} />
      <Boton titulo="Volver: datos y multimedia" secundario disabled={envio.ocupado} onPress={() => router.dismissTo('/mis-eventos/nuevo')} />
    </ScrollView>
  </KeyboardAvoidingView>;
}
