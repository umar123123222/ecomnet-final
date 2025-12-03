import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  ArrowRightLeft, 
  FileSpreadsheet, 
  Settings, 
  Package,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionsPanelProps {
  onAddProduct: () => void;
  onStockAdjustment: () => void;
  onBulkAdjustment: () => void;
  onQuickTransfer: () => void;
  permissions: {
    canAddProducts?: boolean;
    canAdjustStock?: boolean;
    canBulkAdjustStock?: boolean;
    canCreateStockTransfer?: boolean;
  };
}

export function QuickActionsPanel({ 
  onAddProduct, 
  onStockAdjustment, 
  onBulkAdjustment,
  onQuickTransfer,
  permissions 
}: QuickActionsPanelProps) {
  const actions = [
    {
      icon: Plus,
      label: 'Add Product',
      description: 'Create new product',
      onClick: onAddProduct,
      enabled: permissions.canAddProducts,
      color: 'bg-success/10 hover:bg-success/20 text-success border border-success/20',
      iconBg: 'bg-success/20',
    },
    {
      icon: RefreshCw,
      label: 'Stock Adjustment',
      description: 'Adjust stock levels',
      onClick: onStockAdjustment,
      enabled: permissions.canAdjustStock,
      color: 'bg-muted hover:bg-muted/80 text-foreground border border-border',
      iconBg: 'bg-muted-foreground/10',
    },
    {
      icon: FileSpreadsheet,
      label: 'Bulk Adjustment',
      description: 'Upload CSV file',
      onClick: onBulkAdjustment,
      enabled: permissions.canBulkAdjustStock,
      color: 'bg-muted hover:bg-muted/80 text-foreground border border-border',
      iconBg: 'bg-muted-foreground/10',
    },
    {
      icon: ArrowRightLeft,
      label: 'Quick Transfer',
      description: 'Transfer between outlets',
      onClick: onQuickTransfer,
      enabled: permissions.canCreateStockTransfer,
      color: 'bg-muted hover:bg-muted/80 text-foreground border border-border',
      iconBg: 'bg-muted-foreground/10',
    },
  ];

  const quickLinks = [
    {
      icon: TrendingDown,
      label: 'Low Stock Items',
      description: 'View all low stock',
      href: '#low-stock',
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-500/10',
    },
    {
      icon: Package,
      label: 'Packaging Items',
      description: 'Manage packaging',
      href: '#packaging',
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
    },
    {
      icon: AlertCircle,
      label: 'Pending Transfers',
      description: 'Review transfers',
      href: '#transfers',
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-500/10',
    },
    {
      icon: Settings,
      label: 'Smart Reorder',
      description: 'Configure automation',
      href: '#smart-reorder',
      iconColor: 'text-rose-500',
      iconBg: 'bg-rose-500/10',
    },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base md:text-lg font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 md:space-y-5">
        {/* Primary Actions - Responsive Grid */}
        <div className="grid grid-cols-2 gap-2 md:gap-2.5">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                variant="ghost"
                onClick={action.onClick}
                disabled={!action.enabled}
                className={cn(
                  "h-auto flex-col items-start p-2.5 md:p-3 gap-1.5 md:gap-2 rounded-lg md:rounded-xl transition-all duration-200",
                  "hover:scale-[1.01] active:scale-[0.99]",
                  action.color,
                  !action.enabled && "opacity-50 cursor-not-allowed hover:scale-100"
                )}
              >
                <div className={cn("p-1.5 md:p-2 rounded-md md:rounded-lg", action.iconBg)}>
                  <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </div>
                <div className="text-left w-full">
                  <p className="font-medium text-xs md:text-sm leading-tight">{action.label}</p>
                  <p className="text-[10px] md:text-xs opacity-70 font-normal mt-0.5 leading-tight truncate">
                    {action.description}
                  </p>
                </div>
              </Button>
            );
          })}
        </div>

        {/* Quick Links Section */}
        <div>
          <p className="text-xs md:text-sm font-medium text-muted-foreground mb-2 md:mb-2.5">Quick Links</p>
          <div className="space-y-0.5 md:space-y-1">
            {quickLinks.map((link, index) => {
              const Icon = link.icon;
              return (
                <a
                  key={index}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2.5 md:gap-3 p-2 md:p-2.5 rounded-lg md:rounded-xl",
                    "hover:bg-accent/50 transition-all duration-200",
                    "group cursor-pointer"
                  )}
                >
                  <div className={cn(
                    "p-1.5 md:p-2 rounded-md md:rounded-lg shrink-0 transition-transform duration-200",
                    "group-hover:scale-110",
                    link.iconBg
                  )}>
                    <Icon className={cn("h-3.5 w-3.5 md:h-4 md:w-4", link.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium leading-tight truncate">
                      {link.label}
                    </p>
                    <p className="text-[10px] md:text-xs text-muted-foreground leading-tight truncate">
                      {link.description}
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </a>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
