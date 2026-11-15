import { useCallback, useState } from 'react';
import { Redirect } from 'expo-router';
import { FlatList, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSesion } from '../contexto/Sesion';
import { useConsulta } from '../hooks/useConsulta';
import { Boton, Carga, Opcion } from '../ui/Componentes';
import { CabeceraUsuario, Pestañas } from '../ui/Navegacion';
import { estilos as s } from '../ui/tema';
import { useFavoritos } from '../hooks/useFavoritos';
import { EstadoFavoritos } from '../ui/Favoritos';
import { TarjetaEvento } from '../ui/TarjetaEvento';

export default function Catalogo() {
  const { usuario, api } = useSesion();
  const favoritos = useFavoritos();
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [orden, setOrden] = useState('fecha');
  const consulta = useConsulta(useCallback((signal) => api.eventos({ texto: busqueda, categoriaId, orden }, signal), [api, busqueda, categoriaId, orden]));
  const categorias = useConsulta(useCallback((signal) => api.categorias(signal), [api]));
  if (!usuario) return <Redirect href="/usuarios" />;
  return <SafeAreaView edges={['top', 'left', 'right']} style={s.pagina}>
    <FlatList data={consulta.datos ?? []} keyExtractor={(evento) => evento.id} contentContainerStyle={s.contenido}
      keyboardShouldPersistTaps="handled" refreshing={consulta.cargando} onRefresh={consulta.recargar}
      ItemSeparatorComponent={() => <View style={s.separador} />}
      ListHeaderComponent={<View style={{ gap: 14, marginBottom: 16 }}>
        <Text style={s.titulo}>Encontrá tu próximo plan</Text>
        <CabeceraUsuario />
        <TextInput value={texto} onChangeText={setTexto} placeholder="Buscar en título y descripción" accessibilityLabel="Buscar eventos" style={s.input}
          returnKeyType="search" onSubmitEditing={() => setBusqueda(texto.trim())} />
        <Boton titulo="Buscar" onPress={() => setBusqueda(texto.trim())} />
        {!!(texto || busqueda || categoriaId) && <Boton titulo="Limpiar búsqueda y categoría" secundario
          onPress={() => { setTexto(''); setBusqueda(''); setCategoriaId(''); }} />}
        <Text style={s.etiqueta}>Categoría</Text>
        <Carga consulta={categorias} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[{ id: '', nombre: 'Todas' }, ...(categorias.datos ?? [])].map((categoria) => <Opcion key={categoria.id} titulo={categoria.nombre} seleccionada={categoria.id === categoriaId} onPress={() => setCategoriaId(categoria.id)} />)}
        </ScrollView>
        <Text style={s.etiqueta}>Ordenar por</Text>
        <View style={s.fila}>{[['fecha', 'Fecha'], ['precio', 'Precio'], ['puntaje', 'Puntaje']].map(([valor, nombre]) => <Opcion key={valor} titulo={nombre} seleccionada={orden === valor} onPress={() => setOrden(valor)} />)}</View>
        <Text style={s.ayuda}>{busqueda ? `Resultados para “${busqueda}”` : 'Próximos eventos'} · Fechas de Buenos Aires</Text>
        <Carga consulta={consulta} />
        <EstadoFavoritos favoritos={favoritos} />
      </View>}
      ListEmptyComponent={!consulta.cargando && !consulta.error ? <View style={s.tarjeta}><Text style={s.texto}>No encontramos eventos con esos filtros.</Text></View> : undefined}
      renderItem={({ item }) => <TarjetaEvento evento={item} favoritos={favoritos} />} />
    <Pestañas activa="Catálogo" />
  </SafeAreaView>;
}
