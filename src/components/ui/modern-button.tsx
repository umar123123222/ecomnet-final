
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const modernButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden group",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-colored",
        destructive: "bg-gradient-to-r from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600",
        outline: "border-2 border-purple-200 bg-transparent text-purple-600 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50",
        secondary: "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-900 hover:from-gray-200 hover:to-gray-300",
        ghost: "text-purple-600 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50",
        link: "text-purple-600 underline-offset-4 hover:underline",
        success: "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600",
        warning: "bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:from-orange-600 hover:to-yellow-600",
        info: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-13 rounded-xl px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ModernButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof modernButtonVariants> {
  asChild?: boolean
}

const ModernButton = React.forwardRef<HTMLButtonElement, ModernButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(modernButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></span>
        {children}
      </Comp>
    )
  }
)
ModernButton.displayName = "ModernButton"

export { ModernButton, modernButtonVariants }
