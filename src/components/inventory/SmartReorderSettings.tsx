import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, TrendingUp } from "lucide-react";

interface SmartReorderSettingsProps {
  item: any;
  itemType: 'product' | 'packaging';
  suppliers?: any[];
  onUpdate?: () => void;
}

export function SmartReorderSettings({ item, itemType, suppliers = [], onUpdate }: SmartReorderSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  const [settings, setSettings] = useState({
    auto_reorder_enabled: item.auto_reorder_enabled || false,
    lead_time_days: item.lead_time_days || 7,
    safety_stock_level: item.safety_stock_level || 0,
    preferred_supplier_id: item.preferred_supplier_id || '',
  });

  const avgConsumption = itemType === 'product' 
    ? item.avg_daily_sales 
    : item.avg_daily_usage;

  const handleUpdateVelocity = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase.functions.invoke('smart-reorder', {
        body: {
          action: 'update_velocity',
          [`${itemType}_id`]: item.id,
          days_to_analyze: 30
        }
      });

      if (error) throw error;

      toast({
        title: "Velocity Updated",
        description: "Sales velocity has been recalculated based on the last 30 days.",
      });

      onUpdate?.();
    } catch (error: any) {
      console.error('Error updating velocity:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update velocity",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const table = itemType === 'product' ? 'products' : 'packaging_items';
      const { error } = await supabase
        .from(table)
        .update(settings)
        .eq('id', item.id);

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Smart reorder settings have been updated successfully.",
      });

      onUpdate?.();
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const reorderPoint = Math.ceil(
    (avgConsumption || 0) * settings.lead_time_days + settings.safety_stock_level
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Smart Reordering Settings
        </CardTitle>
        <CardDescription>
          Configure automatic reordering based on sales velocity and lead times
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Auto-Reorder</Label>
              <p className="text-sm text-muted-foreground">
                Automatically generate purchase orders when stock is low
              </p>
            </div>
            <Switch
              checked={settings.auto_reorder_enabled}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, auto_reorder_enabled: checked }))
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lead_time">Lead Time (Days)</Label>
              <Input
                id="lead_time"
                type="number"
                min="1"
                value={settings.lead_time_days}
                onChange={(e) => 
                  setSettings(prev => ({ ...prev, lead_time_days: parseInt(e.target.value) || 7 }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Time between ordering and receiving stock
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="safety_stock">Safety Stock Level</Label>
              <Input
                id="safety_stock"
                type="number"
                min="0"
                value={settings.safety_stock_level}
                onChange={(e) => 
                  setSettings(prev => ({ ...prev, safety_stock_level: parseInt(e.target.value) || 0 }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Buffer stock to prevent stockouts
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier">Preferred Supplier</Label>
            <Select
              value={settings.preferred_supplier_id}
              onValueChange={(value) => 
                setSettings(prev => ({ ...prev, preferred_supplier_id: value }))
              }
            >
              <SelectTrigger id="supplier">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <h4 className="text-sm font-medium">Calculated Metrics</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Daily Consumption:</span>
                <span className="font-medium">{(avgConsumption || 0).toFixed(2)} units/day</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Calculated Reorder Point:</span>
                <span className="font-medium">{reorderPoint} units</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current Stock:</span>
                <span className="font-medium">
                  {itemType === 'product' 
                    ? (item.inventory?.[0]?.quantity || 0) 
                    : (item.current_stock || 0)} units
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={handleUpdateVelocity}
              disabled={updating}
            >
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Recalculate Velocity
                </>
              )}
            </Button>
          </div>
        </div>

        <Button 
          onClick={handleSaveSettings} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
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
      </CardContent>
    </Card>
  );
}
