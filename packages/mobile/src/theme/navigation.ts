import { colors } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';

export const navigationStyles = {
  // Tab Navigator Styles
  tabNavigator: {
    activeTintColor: colors.primary.main,
    inactiveTintColor: colors.gray[400],
    style: {
      backgroundColor: colors.white,
      borderTopWidth: 1,
      borderTopColor: colors.gray[200],
      paddingBottom: spacing[2],
      paddingTop: spacing[2],
      height: 60,
    },
    labelStyle: {
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
    },
  },
  
  // Stack Navigator Styles
  stackNavigator: {
    headerStyle: {
      backgroundColor: colors.white,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    headerTitleStyle: {
      fontSize: typography.fontSize.lg,
      fontWeight: typography.fontWeight.semibold,
      color: colors.gray[900],
    },
    headerTintColor: colors.primary.main,
  },
  
  // Drawer Navigator Styles
  drawerNavigator: {
    drawerStyle: {
      backgroundColor: colors.white,
      width: 280,
    },
    drawerContentStyle: {
      backgroundColor: colors.white,
    },
    drawerActiveTintColor: colors.primary.main,
    drawerInactiveTintColor: colors.gray[600],
    drawerLabelStyle: {
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
    },
  },
} as const;