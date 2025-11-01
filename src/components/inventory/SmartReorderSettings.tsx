import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Settings, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface SmartReorderSettings {
  enabled: boolean;
  check_frequency_hours: number;
  auto_create_po: boolean;
  safety_stock_percentage: number;
  lead_time_days: number;
}

export function SmartReorderSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SmartReorderSettings>({
    enabled: false,
    check_frequency_hours: 24,
    auto_create_po: false,
    safety_stock_percentage: 20,
    lead_time_days: 7,
  });

  const { isLoading } = useQuery({
    queryKey: ['smart-reorder-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('smart-reorder', {
        body: { action: 'getSettings' }
      });

      if (error) throw error;
      if (data?.settings) {
        setSettings(data.settings);
      }
      return data?.settings as SmartReorderSettings;
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: SmartReorderSettings) => {
      const { data, error } = await supabase.functions.invoke('smart-reorder', {
        body: { 
          action: 'updateSettings',
          settings: newSettings
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Smart reorder settings saved successfully");
      queryClient.invalidateQueries({ queryKey: ['smart-reorder-settings'] });
    },
    onError: (error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });

  const triggerNowMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('scheduled-smart-reorder', {
        body: { trigger: 'manual' }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Smart reorder check triggered successfully");
      queryClient.invalidateQueries({ queryKey: ['smart-reorder-recommendations'] });
    },
    onError: (error) => {
      toast.error(`Failed to trigger reorder check: ${error.message}`);
    },
  });

  const handleSave = () => {
    saveSettingsMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Smart Reorder Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Smart Reorder Settings
        </CardTitle>
        <CardDescription>
          Configure automated inventory reordering behavior
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enabled">Enable Smart Reorder</Label>
            <p className="text-sm text-muted-foreground">
              Automatically monitor inventory levels and generate reorder recommendations
            </p>
          </div>
          <Switch
            id="enabled"
            checked={settings.enabled}
            onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto_create_po">Auto-Create Purchase Orders</Label>
            <p className="text-sm text-muted-foreground">
              Automatically create purchase orders for recommended items
            </p>
          </div>
          <Switch
            id="auto_create_po"
            checked={settings.auto_create_po}
            onCheckedChange={(checked) => setSettings({ ...settings, auto_create_po: checked })}
            disabled={!settings.enabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="check_frequency">Check Frequency (hours)</Label>
          <Input
            id="check_frequency"
            type="number"
            min="1"
            max="168"
            value={settings.check_frequency_hours}
            onChange={(e) => setSettings({ ...settings, check_frequency_hours: parseInt(e.target.value) || 24 })}
            disabled={!settings.enabled}
          />
          <p className="text-xs text-muted-foreground">
            How often to check inventory levels (1-168 hours)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="safety_stock">Safety Stock Percentage (%)</Label>
          <Input
            id="safety_stock"
            type="number"
            min="0"
            max="100"
            value={settings.safety_stock_percentage}
            onChange={(e) => setSettings({ ...settings, safety_stock_percentage: parseInt(e.target.value) || 20 })}
            disabled={!settings.enabled}
          />
          <p className="text-xs text-muted-foreground">
            Additional buffer stock to maintain (0-100%)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lead_time">Lead Time (days)</Label>
          <Input
            id="lead_time"
            type="number"
            min="1"
            max="90"
            value={settings.lead_time_days}
            onChange={(e) => setSettings({ ...settings, lead_time_days: parseInt(e.target.value) || 7 })}
            disabled={!settings.enabled}
          />
          <p className="text-xs text-muted-foreground">
            Expected days to receive inventory after ordering (1-90 days)
          </p>
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={saveSettingsMutation.isPending}
            className="flex-1"
          >
            {saveSettingsMutation.isPending ? (
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
          <Button
            variant="outline"
            onClick={() => triggerNowMutation.mutate()}
            disabled={triggerNowMutation.isPending || !settings.enabled}
          >
            {triggerNowMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Run Now"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
