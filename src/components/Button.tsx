import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button as UiButton } from '@/components/ui/button';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props },
    ref,
  ) => {
    const variantMap = {
      primary: 'default',
      secondary: 'secondary',
      outline: 'outline',
      ghost: 'ghost',
    } as const;

    const sizeMap = {
      sm: 'sm',
      md: 'default',
      lg: 'lg',
    } as const;

    return (
      <UiButton
        ref={ref}
        variant={variantMap[variant]}
        size={sizeMap[size]}
        className={className}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {children}
      </UiButton>
    );
  },
);

Button.displayName = 'Button';
