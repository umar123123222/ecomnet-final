import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon, Package, FileText, Users, ShoppingCart, Truck } from "lucide-react"
import { Button } from "./button"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon: Icon = Package,
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  )
}

// Pre-configured empty states for common scenarios
export function EmptyOrders({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={ShoppingCart}
      title="No orders found"
      description="Orders will appear here once they are created or imported from Shopify."
      action={onAction ? { label: "Create Order", onClick: onAction } : undefined}
    />
  )
}

export function EmptyProducts({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Package}
      title="No products found"
      description="Add products to your inventory to get started."
      action={onAction ? { label: "Add Product", onClick: onAction } : undefined}
    />
  )
}

export function EmptyCustomers({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="No customers found"
      description="Customers will be created automatically when orders are placed."
      action={onAction ? { label: "Sync Customers", onClick: onAction } : undefined}
    />
  )
}

export function EmptyTransfers({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      icon={Truck}
      title="No transfers found"
      description="Create a stock transfer to move inventory between outlets."
      action={onAction ? { label: "Request Transfer", onClick: onAction } : undefined}
    />
  )
}

export function EmptyDocuments() {
  return (
    <EmptyState
      icon={FileText}
      title="No documents found"
      description="Documents will appear here once they are generated."
    />
  )
}
