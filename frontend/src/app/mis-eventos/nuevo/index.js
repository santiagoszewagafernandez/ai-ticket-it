import { useCallback, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useSesion } from '../../../contexto/Sesion';
import { useFormularioEvento } from '../../../contexto/FormularioEvento';
import { datosEvento } from '../../../formularios/evento';
import { useConsulta } from '../../../hooks/useConsulta';
import { Aviso, Boton, Carga, Opcion } from '../../../ui/Componentes';
import { Campo } from '../../../ui/Campo';
import { estilos as s } from '../../../ui/tema';

export default function DatosEvento() {
  const { usuario, api } = useSesion();
  const { formulario: f, setFormulario } = useFormularioEvento();
  const [error, setError] = useState('');
  const categorias = useConsulta(useCallback((signal) => api.categorias(signal), [api]));
  /** @param {keyof typeof f} campo @param {string} valor */
  const cambiar = (campo, valor) => setFormulario((actual) => ({ ...actual, [campo]: valor }));
  /** @param {number} indice @param {{tipo?: string, url?: string}} cambio */
  const medio = (indice, cambio) => setFormulario((actual) => ({ ...actual, multimedia: actual.multimedia.map((valor, i) => i === indice ? { ...valor, ...cambio } : valor) }));
  if (!usuario) return <Redirect href="/usuarios" />;
  function siguiente() {
    try { datosEvento(f); setError(''); router.push('/mis-eventos/nuevo/tipos'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Revisá los datos.'); }
  }
  return <KeyboardAvoidingView style={s.pagina} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={96}>
    <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text style={s.etiqueta}>Paso 1 de 2 · Organiza {usuario.nombre}</Text>
      <Text style={s.titulo}>Datos del evento</Text>
      <Text style={s.ayuda}>Podés volver entre los pasos sin perder lo escrito. El formulario se conserva durante esta sesión; reiniciar la app o cambiar de usuario lo descarta.</Text>
      <Campo etiqueta="Título" value={f.titulo} onChangeText={(valor) => cambiar('titulo', valor)} />
      <Campo etiqueta="Descripción" value={f.descripcion} multiline onChangeText={(valor) => cambiar('descripcion', valor)} />
      <Campo etiqueta="Lugar (opcional)" value={f.lugar} onChangeText={(valor) => cambiar('lugar', valor)} />
      <Text style={s.etiqueta}>Categoría</Text>
      <Carga consulta={categorias} />
      <View style={s.fila}>{categorias.datos?.map((categoria) => <Opcion key={categoria.id} titulo={categoria.nombre} seleccionada={f.categoriaId === categoria.id} onPress={() => cambiar('categoriaId', categoria.id)} />)}</View>
      <Text style={s.ayuda}>Fechas y horas de Buenos Aires · formato de 24 horas</Text>
      <Campo etiqueta="Fecha de inicio · DD/MM/AAAA" placeholder="15/11/2026" value={f.inicioFecha} keyboardType="numbers-and-punctuation" onChangeText={(valor) => cambiar('inicioFecha', valor)} />
      <Campo etiqueta="Hora de inicio · HH:mm" placeholder="18:00" value={f.inicioHora} keyboardType="numbers-and-punctuation" onChangeText={(valor) => cambiar('inicioHora', valor)} />
      <Campo etiqueta="Fecha de fin · DD/MM/AAAA" placeholder="15/11/2026" value={f.finFecha} keyboardType="numbers-and-punctuation" onChangeText={(valor) => cambiar('finFecha', valor)} />
      <Campo etiqueta="Hora de fin · HH:mm" placeholder="21:00" value={f.finHora} keyboardType="numbers-and-punctuation" onChangeText={(valor) => cambiar('finHora', valor)} />
      <Text style={s.subtitulo}>Imágenes y videos por URL</Text>
      <Text style={s.ayuda}>Opcional. Pegá un enlace HTTP o HTTPS directo a cada imagen o video.</Text>
      {f.multimedia.map((valor, i) => <View key={i} style={s.tarjeta}>
        <Text style={s.etiqueta}>Medio {i + 1}</Text>
        <View style={s.fila}>{['imagen', 'video'].map((tipo) => <Opcion key={tipo} titulo={tipo === 'imagen' ? 'Imagen' : 'Video'} seleccionada={valor.tipo === tipo} onPress={() => medio(i, { tipo })} />)}</View>
        <Campo etiqueta={`URL del medio ${i + 1}`} value={valor.url} keyboardType="url" autoCapitalize="none" autoCorrect={false} onChangeText={(url) => medio(i, { url })} />
        <Boton titulo={`Quitar medio ${i + 1}`} secundario onPress={() => setFormulario((actual) => ({ ...actual, multimedia: actual.multimedia.filter((_, indice) => indice !== i) }))} />
      </View>)}
      <Boton titulo="Agregar imagen o video" secundario onPress={() => setFormulario((actual) => ({ ...actual, multimedia: [...actual.multimedia, { tipo: 'imagen', url: '' }] }))} />
      <Aviso mensaje={error} />
      <Boton titulo="Siguiente: tipos de entrada" onPress={siguiente} />
      <Boton titulo="Volver a Mis eventos" secundario onPress={() => router.replace('/mis-eventos')} />
    </ScrollView>
  </KeyboardAvoidingView>;
}
