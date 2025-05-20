// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
export type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'clock.fill': 'schedule',
  'moon.stars.fill': 'nights-stay',
  'sunrise.fill': 'wb-sunny',
  'sun.max.fill': 'brightness-high',
  'cloud.sun.fill': 'wb-cloudy',
  'sunset.fill': 'brightness-6',
  'moon.fill': 'brightness-2',
  'calendar': 'calendar-today',
  'bell.fill': 'notifications',
  'location.north.line.fill': 'explore',
  'location.north.fill': 'navigation',
  'book.fill': 'menu-book',
  'gearshape.fill': 'settings',
  'chevron.up': 'keyboard-arrow-up',
  'chevron.down': 'keyboard-arrow-down',
  'doc.on.doc.fill': 'file-copy',
  'doc.on.clipboard.fill': 'assignment',
  'square.and.arrow.up.fill': 'share',
  'play.fill': 'play-arrow',
  'pause.fill': 'pause',
  'arrow.clockwise': 'loop',
  'pencil.circle.fill': 'edit',
  'heart': 'favorite-border',
  'heart.fill': 'favorite',
  'arrow.triangle.2.circlepath': 'refresh',
  'xmark.circle.fill': 'cancel',
  'trash.fill': 'delete',
  'checkmark.circle.fill': 'check-circle',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
