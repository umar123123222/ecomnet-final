
import * as React from "react"
import { cn } from "@/lib/utils"

interface GradientCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'glass'
}

const GradientCard = React.forwardRef<HTMLDivElement, GradientCardProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variantClasses = {
      default: "bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800",
      primary: "gradient-primary text-white",
      secondary: "gradient-secondary text-white", 
      glass: "glass-effect text-foreground"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border shadow-modern backdrop-blur-sm transition-all duration-300 hover:shadow-modern-lg",
          variantClasses[variant],
          className
        )}
        {...props}
      />
    )
  }
)
GradientCard.displayName = "GradientCard"

export { GradientCard }
