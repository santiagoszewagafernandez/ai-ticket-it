import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text } from 'react-native';
import { estilos as s } from './tema';

/** @param {{compra: import('../api/tipos').Compra, alVencer: () => void}} props */
export function PlazoReserva({ compra, alVencer }) {
  const [restantes, setRestantes] = useState(0);
  useFocusEffect(useCallback(() => {
    const inicioLocal = Date.now();
    const duracion = Math.max(0, Date.parse(compra.vencimiento) - Date.parse(compra.servidorAhora));
    let notificado = false;
    function actualizar() {
      const ms = Math.max(0, duracion - (Date.now() - inicioLocal));
      setRestantes(Math.ceil(ms / 1000));
      if (ms === 0 && !notificado) { notificado = true; alVencer(); }
    }
    actualizar();
    const timer = setInterval(actualizar, 1000);
    return () => clearInterval(timer);
  }, [compra.vencimiento, compra.servidorAhora, alVencer]));
  return <Text style={s.texto}>Tiempo para pagar: {Math.floor(restantes / 60)}:{String(restantes % 60).padStart(2, '0')}</Text>;
}
