import { Text, View } from 'react-native';
import { estilos as s, fecha } from './tema';

/** @param {{resena: import('../api/tipos').Resena}} props */
export function TuResena({ resena }) {
  return <View style={s.tarjeta}>
    <Text style={s.subtitulo}>Tu reseña</Text>
    <Text style={s.etiqueta}>{'★'.repeat(resena.puntaje)} · {resena.puntaje} de 5</Text>
    <Text style={s.texto}>{resena.comentario}</Text>
    <Text style={s.ayuda}>{resena.evento.titulo} · {fecha(resena.fecha)}</Text>
  </View>;
}
