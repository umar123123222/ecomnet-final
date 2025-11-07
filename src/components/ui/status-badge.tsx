
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-all duration-300 backdrop-blur-sm",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 dark:from-gray-800 dark:to-gray-700 dark:text-gray-200",
        success: "bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 dark:from-green-900/30 dark:to-emerald-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
        warning: "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 dark:from-amber-900/30 dark:to-yellow-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
        destructive: "bg-gradient-to-r from-red-100 to-pink-100 text-red-800 dark:from-red-900/30 dark:to-pink-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
        info: "bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-800 dark:from-blue-900/30 dark:to-cyan-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
        pending: "bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 dark:from-purple-900/30 dark:to-pink-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800",
        processing: "bg-gradient-to-r from-indigo-100 to-blue-100 text-indigo-800 dark:from-indigo-900/30 dark:to-blue-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  pulse?: boolean
}

function StatusBadge({ className, variant, pulse, ...props }: StatusBadgeProps) {
  return (
    <div 
      className={cn(
        statusBadgeVariants({ variant }), 
        pulse && "animate-pulse",
        "transition-transform duration-200 hover:scale-105",
        className
      )} 
      {...props} 
    />
  )
}

export { StatusBadge, statusBadgeVariants }
