import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ModernButton } from '@/components/ui/modern-button';
import { Save, Eye, EyeOff, Key, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface APISetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string;
  updated_at: string;
}

interface APISettingsCardProps {
  isSuperAdmin: boolean;
}

export function APISettingsCard({ isSuperAdmin }: APISettingsCardProps) {
  const [settings, setSettings] = useState<APISetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isSuperAdmin) {
      loadSettings();
    }
  }, [isSuperAdmin]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_settings')
        .select('*')
        .order('setting_key');

      if (error) throw error;

      setSettings(data || []);
      
      // Initialize edited values
      const initialValues: Record<string, string> = {};
      data?.forEach(setting => {
        initialValues[setting.setting_key] = setting.setting_value;
      });
      setEditedValues(initialValues);
    } catch (error) {
      console.error('Error loading API settings:', error);
      toast.error('Failed to load API settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = settings.map(setting => ({
        id: setting.id,
        setting_value: editedValues[setting.setting_key] || setting.setting_value,
        updated_at: new Date().toISOString()
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('api_settings')
          .update({
            setting_value: update.setting_value,
            updated_at: update.updated_at
          })
          .eq('id', update.id);

        if (error) throw error;
      }

      toast.success('API settings updated successfully');
      await loadSettings();
    } catch (error) {
      console.error('Error saving API settings:', error);
      toast.error('Failed to save API settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleShowValue = (key: string) => {
    setShowValues(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleValueChange = (key: string, value: string) => {
    setEditedValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (!isSuperAdmin) {
    return null;
  }

  if (loading) {
    return (
      <Card className="modern-card">
        <CardContent className="card-content py-8">
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading API settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const settingGroups = {
    'WhatsApp': settings.filter(s => s.setting_key.startsWith('WHATSAPP_')),
    'Courier APIs': settings.filter(s => ['TCS_API_KEY', 'LEOPARD_API_KEY', 'POSTEX_API_KEY'].includes(s.setting_key)),
    'Shopify': settings.filter(s => s.setting_key.startsWith('SHOPIFY_'))
  };

  return (
    <Card className="modern-card">
      <CardHeader className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="card-title flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Configuration
            </CardTitle>
            <CardDescription className="card-description">
              Manage API keys and credentials for third-party integrations
            </CardDescription>
          </div>
          <Badge variant="default" className="bg-red-500">
            Super Admin Only
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="card-content space-y-6">
        {Object.entries(settingGroups).map(([groupName, groupSettings]) => (
          groupSettings.length > 0 && (
            <div key={groupName} className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">{groupName}</h3>
              <div className="space-y-4">
                {groupSettings.map((setting) => (
                  <div key={setting.id} className="form-group">
                    <Label htmlFor={setting.setting_key} className="form-label">
                      {setting.description || setting.setting_key}
                    </Label>
                    <div className="relative">
                      <Input
                        id={setting.setting_key}
                        type={showValues[setting.setting_key] ? 'text' : 'password'}
                        className="form-input pr-10"
                        value={editedValues[setting.setting_key] || ''}
                        onChange={(e) => handleValueChange(setting.setting_key, e.target.value)}
                        placeholder={`Enter ${setting.description || setting.setting_key}`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowValue(setting.setting_key)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showValues[setting.setting_key] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {setting.updated_at && (
                      <p className="form-helper">
                        Last updated: {new Date(setting.updated_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        ))}

        <div className="flex justify-between pt-4 border-t border-border">
          <ModernButton 
            variant="outline" 
            onClick={loadSettings}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </ModernButton>
          <ModernButton 
            onClick={handleSave}
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save All Changes
              </>
            )}
          </ModernButton>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Security Note:</strong> These API keys are sensitive. Store them securely and never share them publicly. 
            Changes will take effect immediately for all API calls.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
