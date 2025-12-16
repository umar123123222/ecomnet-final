import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

type StatsVariant = "default" | "success" | "warning" | "danger" | "info"

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  variant?: StatsVariant
  className?: string
}

const variantStyles: Record<StatsVariant, { bg: string; text: string }> = {
  default: { bg: "bg-primary/10", text: "text-primary" },
  success: { bg: "bg-success/10", text: "text-success" },
  warning: { bg: "bg-warning/10", text: "text-warning" },
  danger: { bg: "bg-destructive/10", text: "text-destructive" },
  info: { bg: "bg-info/10", text: "text-info" },
}

export function StatsCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  variant = "default",
  className 
}: StatsCardProps) {
  const styles = variantStyles[variant]
  
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground break-all">{value}</p>
            {description && (
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{description}</p>
            )}
          </div>
          {Icon && (
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", styles.bg)}>
              <Icon className={cn("h-5 w-5", styles.text)} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
