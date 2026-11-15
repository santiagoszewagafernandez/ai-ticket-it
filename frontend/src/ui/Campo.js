import { Text, TextInput, View } from 'react-native';
import { estilos as s } from './tema';

/** @param {import('react-native').TextInputProps & {etiqueta: string}} props */
export function Campo({ etiqueta, ...props }) {
  return <View style={{ gap: 6 }}>
    <Text style={s.etiqueta}>{etiqueta}</Text>
    <TextInput accessibilityLabel={etiqueta} style={[s.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }]} {...props} />
  </View>;
}
