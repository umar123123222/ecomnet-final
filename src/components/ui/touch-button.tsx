import React, { forwardRef } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TouchButtonProps extends ButtonProps {
  feedbackScale?: 'sm' | 'md' | 'lg';
}

/**
 * TouchButton - A button with enhanced touch feedback for mobile devices.
 * Adds scale animation on touch/click for better tactile feedback.
 */
export const TouchButton = forwardRef<HTMLButtonElement, TouchButtonProps>(
  ({ className, feedbackScale = 'md', children, ...props }, ref) => {
    const scaleClasses = {
      sm: 'active:scale-[0.98]',
      md: 'active:scale-95',
      lg: 'active:scale-90',
    };

    return (
      <Button
        ref={ref}
        className={cn(
          "transition-transform touch-manipulation",
          scaleClasses[feedbackScale],
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

TouchButton.displayName = 'TouchButton';
