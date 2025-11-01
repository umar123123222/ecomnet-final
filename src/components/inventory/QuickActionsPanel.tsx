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
  AlertCircle
} from "lucide-react";

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
      variant: 'default' as const,
    },
    {
      icon: RefreshCw,
      label: 'Stock Adjustment',
      description: 'Adjust stock levels',
      onClick: onStockAdjustment,
      enabled: permissions.canAdjustStock,
      variant: 'secondary' as const,
    },
    {
      icon: FileSpreadsheet,
      label: 'Bulk Adjustment',
      description: 'Upload CSV file',
      onClick: onBulkAdjustment,
      enabled: permissions.canBulkAdjustStock,
      variant: 'secondary' as const,
    },
    {
      icon: ArrowRightLeft,
      label: 'Quick Transfer',
      description: 'Transfer between outlets',
      onClick: onQuickTransfer,
      enabled: permissions.canCreateStockTransfer,
      variant: 'secondary' as const,
    },
  ];

  const quickLinks = [
    {
      icon: TrendingDown,
      label: 'Low Stock Items',
      description: 'View all low stock',
      href: '#low-stock',
    },
    {
      icon: Package,
      label: 'Packaging Items',
      description: 'Manage packaging',
      href: '#packaging',
    },
    {
      icon: AlertCircle,
      label: 'Pending Transfers',
      description: 'Review transfers',
      href: '#transfers',
    },
    {
      icon: Settings,
      label: 'Smart Reorder',
      description: 'Configure automation',
      href: '#smart-reorder',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Primary Actions */}
          <div className="grid grid-cols-2 gap-3">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <Button
                  key={index}
                  variant={action.variant}
                  onClick={action.onClick}
                  disabled={!action.enabled}
                  className="h-auto flex-col items-start p-4 gap-2"
                >
                  <Icon className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-medium text-sm">{action.label}</p>
                    <p className="text-xs opacity-70 font-normal">{action.description}</p>
                  </div>
                </Button>
              );
            })}
          </div>

          {/* Quick Links */}
          <div>
            <p className="text-sm font-medium mb-3">Quick Links</p>
            <div className="space-y-2">
              {quickLinks.map((link, index) => {
                const Icon = link.icon;
                return (
                  <a
                    key={index}
                    href={link.href}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="p-2 bg-accent rounded">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{link.label}</p>
                      <p className="text-xs text-muted-foreground">{link.description}</p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
