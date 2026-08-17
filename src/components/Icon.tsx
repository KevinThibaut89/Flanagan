import type { ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SymbolView, type SFSymbol } from 'expo-symbols';

type MaterialName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Semantic icon names mapped to an SF Symbol (iOS) and a Material Community
 * icon used as the fallback everywhere SF Symbols don't exist — Android, and
 * older iOS versions missing a particular symbol.
 */
const ICONS = {
  bar: ['wineglass', 'bottle-wine-outline'],
  scan: ['barcode.viewfinder', 'barcode-scan'],
  ask: ['sparkles', 'glass-cocktail'],
  recipes: ['book.closed', 'notebook-outline'],
  search: ['magnifyingglass', 'magnify'],
  clear: ['xmark.circle.fill', 'close-circle'],
  add: ['plus', 'plus'],
  staples: ['slider.horizontal.3', 'tune-variant'],
  settings: ['gearshape', 'cog-outline'],
  edit: ['square.and.pencil', 'pencil-outline'],
  alert: ['exclamationmark.triangle', 'alert-outline'],
  info: ['info.circle', 'information-outline'],
  delete: ['trash', 'trash-can-outline'],
  star: ['star', 'star-outline'],
  starFill: ['star.fill', 'star'],
  checkCircle: ['checkmark.circle', 'check-circle-outline'],
  checkCircleFill: ['checkmark.circle.fill', 'check-circle'],
  circle: ['circle', 'circle-outline'],
  close: ['xmark', 'close'],
  check: ['checkmark', 'check'],
  checkboxOn: ['checkmark.square.fill', 'checkbox-marked'],
  checkboxOff: ['square', 'checkbox-blank-outline'],
  bullet: ['circle.fill', 'circle-small'],
  picker: ['chevron.up.chevron.down', 'chevron-down'],
  cart: ['cart', 'cart-outline'],
} satisfies Record<string, [SFSymbol, MaterialName]>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: IconName;
  size?: number;
  color: string;
}) {
  const [symbol, material] = ICONS[name];
  return (
    <SymbolView
      name={symbol}
      size={size}
      tintColor={color}
      fallback={<MaterialCommunityIcons name={material} size={size} color={color} />}
    />
  );
}
