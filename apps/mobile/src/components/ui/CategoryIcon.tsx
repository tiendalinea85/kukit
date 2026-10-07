import { Image, Text, View } from 'react-native';
import { categoryIconText, isDataUrlIcon } from '../../features/catalog/domain/categoryIcon';

// `Category.icon` es un emoji del catálogo o, si el usuario subió una imagen
// desde la PWA, un data URL PNG. Este componente es el único sitio que decide
// entre <Image> y texto; el data URL NUNCA se pinta como texto porque son
// cientos de KB de base64.

interface Props {
  icon: string | undefined;
  size?: number;
}

export function CategoryIcon({ icon, size = 22 }: Props) {
  if (!icon) return null;

  if (isDataUrlIcon(icon)) {
    return (
      <Image
        source={{ uri: icon }}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <Text style={{ fontSize: size, lineHeight: size + 4 }} allowFontScaling={false}>
      {categoryIconText(icon)}
    </Text>
  );
}

/**
 * Ídem pero reserva el hueco aunque no haya icono, para que las filas con y
 * sin icono mantengan el texto alineado.
 */
export function CategoryIconSlot({ icon, size = 22 }: Props) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <CategoryIcon icon={icon} size={size} />
    </View>
  );
}