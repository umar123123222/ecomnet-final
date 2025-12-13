import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "./badge"
import { LucideIcon, CheckCircle, Clock, XCircle, AlertTriangle, Truck, Package, RotateCcw } from "lucide-react"

type StatusType = 
  | "pending" | "processing" | "booked" | "dispatched" | "delivered" 
  | "returned" | "cancelled" | "failed" | "success" | "warning" | "info"
  | "approved" | "rejected" | "in_transit" | "completed" | "active" | "inactive"

interface StatusConfig {
  label: string
  icon: LucideIcon
  className: string
}

const statusConfigs: Record<StatusType, StatusConfig> = {
  pending: { label: "Pending", icon: Clock, className: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400" },
  processing: { label: "Processing", icon: Clock, className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400" },
  booked: { label: "Booked", icon: Package, className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400" },
  dispatched: { label: "Dispatched", icon: Truck, className: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400" },
  delivered: { label: "Delivered", icon: CheckCircle, className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400" },
  returned: { label: "Returned", icon: RotateCcw, className: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400" },
  cancelled: { label: "Cancelled", icon: XCircle, className: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/30 dark:text-gray-400" },
  failed: { label: "Failed", icon: XCircle, className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400" },
  success: { label: "Success", icon: CheckCircle, className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400" },
  warning: { label: "Warning", icon: AlertTriangle, className: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400" },
  info: { label: "Info", icon: Clock, className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400" },
  approved: { label: "Approved", icon: CheckCircle, className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rejected", icon: XCircle, className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400" },
  in_transit: { label: "In Transit", icon: Truck, className: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400" },
  completed: { label: "Completed", icon: CheckCircle, className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400" },
  active: { label: "Active", icon: CheckCircle, className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400" },
  inactive: { label: "Inactive", icon: XCircle, className: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/30 dark:text-gray-400" },
}

interface StatusIndicatorProps {
  status: string
  showIcon?: boolean
  customLabel?: string
  size?: "sm" | "default"
  className?: string
}

export function StatusIndicator({
  status,
  showIcon = true,
  customLabel,
  size = "default",
  className
}: StatusIndicatorProps) {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_') as StatusType
  const config = statusConfigs[normalizedStatus] || {
    label: status,
    icon: Clock,
    className: "bg-gray-100 text-gray-800 border-gray-300"
  }
  
  const Icon = config.icon
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "border gap-1",
        config.className,
        size === "sm" && "text-xs py-0 px-1.5",
        className
      )}
    >
      {showIcon && <Icon className={cn("h-3 w-3", size === "sm" && "h-2.5 w-2.5")} />}
      {customLabel || config.label}
    </Badge>
  )
}
