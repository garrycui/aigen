
import React from 'react';
import { m, HTMLMotionProps } from 'framer-motion';
import { useAnimation } from './AnimationProvider';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const { prefersReducedMotion } = useAnimation();
  
  const baseStyles = "rounded-lg font-medium transition-all flex items-center justify-center";
  
  const variantStyles = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm",
    secondary: "bg-indigo-100 hover:bg-indigo-200 text-indigo-700",
    outline: "bg-transparent border border-indigo-600 text-indigo-600 hover:bg-indigo-50",
    text: "bg-transparent text-indigo-600 hover:bg-indigo-50 shadow-none",
    danger: "bg-red-600 hover:bg-red-700 text-white shadow-sm"
  };
  
  const sizeStyles = {
    sm: "text-xs px-2.5 py-1.5 gap-1",
    md: "text-sm px-4 py-2 gap-2",
    lg: "text-base px-6 py-3 gap-2.5"
  };
  
  const disabledStyles = "opacity-70 cursor-not-allowed";
  const widthStyle = fullWidth ? "w-full" : "";
  
  const buttonStyles = `
    ${baseStyles} 
    ${variantStyles[variant]} 
    ${sizeStyles[size]} 
    ${disabled || isLoading ? disabledStyles : ""}
    ${widthStyle}
    ${className}
  `;
  
  // Animation variants
  const buttonVariants = {
    hover: {
      scale: prefersReducedMotion ? 1 : 1.03,
      transition: { duration: 0.2 }
    },
    tap: {
      scale: prefersReducedMotion ? 1 : 0.97,
      transition: { duration: 0.1 }
    },
    initial: {
      scale: 1
    }
  };

  return (
    <m.button
      className={buttonStyles}
      disabled={disabled || isLoading}
      initial="initial"
      whileHover="hover"
      whileTap="tap"
      variants={buttonVariants}
      {...props}
    >
      {isLoading && (
        <span className="inline-block animate-spin mr-2">
          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </span>
      )}
      
      {!isLoading && icon && iconPosition === 'left' && (
        <span className="inline-block">{icon}</span>
      )}
      
      <span>{children}</span>
      
      {!isLoading && icon && iconPosition === 'right' && (
        <span className="inline-block">{icon}</span>
      )}
    </m.button>
  );
};

export default Button;