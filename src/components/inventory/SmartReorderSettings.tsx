import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface SmartReorderSettingsProps {
  item: any;
  itemType: 'product' | 'packaging';
  suppliers: Array<{ id: string; name: string }>;
  onUpdate: () => void;
}

export function SmartReorderSettings({ item, itemType, suppliers, onUpdate }: SmartReorderSettingsProps) {
  const queryClient = useQueryClient();
  const [autoReorderEnabled, setAutoReorderEnabled] = useState(false);
  const [reorderLevel, setReorderLevel] = useState(0);
  const [safetyStockLevel, setSafetyStockLevel] = useState(0);
  const [leadTimeDays, setLeadTimeDays] = useState(7);
  const [preferredSupplierId, setPreferredSupplierId] = useState<string>('');
  const [avgDailyUsage, setAvgDailyUsage] = useState(0);

  useEffect(() => {
    if (item) {
      setAutoReorderEnabled(item.auto_reorder_enabled || false);
      setReorderLevel(item.reorder_level || 0);
      setSafetyStockLevel(item.safety_stock_level || 0);
      setLeadTimeDays(item.lead_time_days || 7);
      setPreferredSupplierId(item.preferred_supplier_id || item.supplier_id || '');
      setAvgDailyUsage(item.avg_daily_usage || 0);
    }
  }, [item]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const tableName = itemType === 'product' ? 'products' : 'packaging_items';
      const { error } = await supabase
        .from(tableName)
        .update({
          auto_reorder_enabled: autoReorderEnabled,
          reorder_level: reorderLevel,
          safety_stock_level: safetyStockLevel,
          lead_time_days: leadTimeDays,
          preferred_supplier_id: preferredSupplierId || null,
          avg_daily_usage: avgDailyUsage,
        })
        .eq('id', item.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Smart reorder settings updated successfully");
      queryClient.invalidateQueries({ queryKey: [itemType === 'product' ? 'products' : 'packaging-items'] });
      onUpdate();
    },
    onError: (error) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="auto_reorder">Enable Auto-Reorder</Label>
          <p className="text-sm text-muted-foreground">
            Automatically reorder this item when stock is low
          </p>
        </div>
        <Switch
          id="auto_reorder"
          checked={autoReorderEnabled}
          onCheckedChange={setAutoReorderEnabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reorder_level">Reorder Level</Label>
        <Input
          id="reorder_level"
          type="number"
          min="0"
          value={reorderLevel}
          onChange={(e) => setReorderLevel(parseInt(e.target.value) || 0)}
          disabled={!autoReorderEnabled}
        />
        <p className="text-xs text-muted-foreground">
          Trigger reorder when stock falls below this level
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="safety_stock">Safety Stock Level</Label>
        <Input
          id="safety_stock"
          type="number"
          min="0"
          value={safetyStockLevel}
          onChange={(e) => setSafetyStockLevel(parseInt(e.target.value) || 0)}
          disabled={!autoReorderEnabled}
        />
        <p className="text-xs text-muted-foreground">
          Minimum buffer stock to maintain
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="avg_daily_usage">Average Daily Usage</Label>
        <Input
          id="avg_daily_usage"
          type="number"
          min="0"
          step="0.1"
          value={avgDailyUsage}
          onChange={(e) => setAvgDailyUsage(parseFloat(e.target.value) || 0)}
          disabled={!autoReorderEnabled}
        />
        <p className="text-xs text-muted-foreground">
          Estimated daily consumption rate
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="lead_time">Lead Time (days)</Label>
        <Input
          id="lead_time"
          type="number"
          min="1"
          max="90"
          value={leadTimeDays}
          onChange={(e) => setLeadTimeDays(parseInt(e.target.value) || 7)}
          disabled={!autoReorderEnabled}
        />
        <p className="text-xs text-muted-foreground">
          Days to receive stock after ordering
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="preferred_supplier">Preferred Supplier</Label>
        <Select
          value={preferredSupplierId}
          onValueChange={setPreferredSupplierId}
          disabled={!autoReorderEnabled}
        >
          <SelectTrigger id="preferred_supplier">
            <SelectValue placeholder="Select supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Default supplier for auto-generated purchase orders
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          onClick={() => onUpdate()}
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
