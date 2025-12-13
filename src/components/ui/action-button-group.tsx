import * as React from "react"
import { cn } from "@/lib/utils"
import { Button, ButtonProps } from "./button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu"
import { MoreHorizontal, LucideIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

interface ActionItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  variant?: ButtonProps["variant"]
  disabled?: boolean
  disabledReason?: string
  destructive?: boolean
  hidden?: boolean
}

interface ActionButtonGroupProps {
  actions: ActionItem[]
  maxVisible?: number
  size?: ButtonProps["size"]
  className?: string
}

export function ActionButtonGroup({
  actions,
  maxVisible = 2,
  size = "sm",
  className
}: ActionButtonGroupProps) {
  const visibleActions = actions.filter(a => !a.hidden)
  const primaryActions = visibleActions.slice(0, maxVisible)
  const overflowActions = visibleActions.slice(maxVisible)

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <TooltipProvider>
        {primaryActions.map((action, index) => {
          const Icon = action.icon
          const button = (
            <Button
              key={index}
              variant={action.variant || "ghost"}
              size={size}
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                "gap-1",
                action.destructive && "text-destructive hover:text-destructive hover:bg-destructive/10"
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span className="hidden sm:inline">{action.label}</span>
            </Button>
          )

          if (action.disabled && action.disabledReason) {
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <span>{button}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{action.disabledReason}</p>
                </TooltipContent>
              </Tooltip>
            )
          }

          return button
        })}
      </TooltipProvider>

      {overflowActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size={size} className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">More actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-50 bg-popover">
            {overflowActions.map((action, index) => {
              const Icon = action.icon
              return (
                <DropdownMenuItem
                  key={index}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={cn(
                    action.destructive && "text-destructive focus:text-destructive"
                  )}
                >
                  {Icon && <Icon className="mr-2 h-4 w-4" />}
                  {action.label}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
