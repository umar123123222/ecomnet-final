import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TruncatedTextProps {
  text: string | number;
  className?: string;
  maxWidth?: string;
  children?: React.ReactNode;
}

export const TruncatedText: React.FC<TruncatedTextProps> = ({
  text,
  className,
  maxWidth = 'max-w-[150px]',
  children,
}) => {
  const displayText = String(text);
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span className={cn("truncate block cursor-default", maxWidth, className)}>
            {children || displayText}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[300px] break-words">
          <p>{displayText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
