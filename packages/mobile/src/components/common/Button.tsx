import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  onPress,
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}) => {
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return styles.primary;
      case 'secondary':
        return styles.secondary;
      case 'outline':
        return styles.outline;
      case 'text':
        return styles.text;
      case 'danger':
        return styles.danger;
      default:
        return styles.primary;
    }
  };

  const getTextStyles = (): TextStyle => {
    switch (variant) {
      case 'primary':
        return styles.primaryText;
      case 'secondary':
        return styles.secondaryText;
      case 'outline':
        return styles.outlineText;
      case 'text':
        return styles.textText;
      case 'danger':
        return styles.dangerText;
      default:
        return styles.primaryText;
    }
  };

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return styles.small;
      case 'md':
        return styles.medium;
      case 'lg':
        return styles.large;
      default:
        return styles.medium;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      style={[
        styles.button,
        getVariantStyles(),
        getSizeStyles(),
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'outline' ? '#4f46e5' : '#ffffff'} />
      ) : (
        <Text style={[getTextStyles(), textStyle]}>{children}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.7,
  },
  // Variants
  primary: {
    backgroundColor: '#4f46e5',
  },
  secondary: {
    backgroundColor: '#e0e7ff',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  text: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: '#ef4444',
  },
  // Text styles
  primaryText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  secondaryText: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  outlineText: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  textText: {
    color: '#4f46e5',
    fontWeight: '600',
  },
  dangerText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  // Sizes
  small: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  medium: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  large: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
});

export default Button;