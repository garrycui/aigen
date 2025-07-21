// Single import point for all theme resources
export * from './colors';
export * from './typography';
export * from './spacing';
export * from './navigation';
export * from './screens';

import { colors } from './colors';
import { typography } from './typography';
import { spacing, borderRadius } from './spacing';
import { navigationStyles } from './navigation';
import { screenStyles } from './screens';

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  navigation: navigationStyles,
  screens: screenStyles,
} as const;

export type Theme = typeof theme;
export default theme;