import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Save, TestTube, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CourierConfig {
  id?: string;
  name: string;
  code: string;
  is_active: boolean;
  auth_type?: 'bearer_token' | 'api_key_header' | 'basic_auth' | 'custom';
  api_endpoint?: string;
  api_key?: string;
  api_key_header?: string;
  api_username?: string;
  api_password?: string;
  pickup_address_code?: string;
  booking_endpoint?: string;
  tracking_endpoint?: string;
  label_endpoint?: string;
  cancellation_endpoint?: string;
  update_endpoint?: string;
  rates_endpoint?: string;
  bulk_booking_endpoint?: string;
  bulk_tracking_endpoint?: string;
  load_sheet_endpoint?: string;
  awb_endpoint?: string;
  shipper_advice_list_endpoint?: string;
  shipper_advice_save_endpoint?: string;
  tariff_endpoint?: string;
  label_format?: 'pdf' | 'html' | 'png' | 'url';
  auto_download_label?: boolean;
  auth_config?: any;
}

type FieldType = 'text' | 'password' | 'select' | 'switch';

interface FieldDefinition {
  key: keyof CourierConfig;
  label: string;
  category: 'Authentication' | 'Endpoints' | 'Settings';
  type: FieldType;
  placeholder?: string;
  description?: string;
  options?: { value: string; label: string }[];
  dependsOn?: { field: keyof CourierConfig; value: any };
}

const COURIER_FIELDS: FieldDefinition[] = [
  // Authentication
  { key: 'auth_type', label: 'Authentication Type', category: 'Authentication', type: 'select', options: [
    { value: 'bearer_token', label: 'Bearer Token' },
    { value: 'api_key_header', label: 'API Key Header' },
    { value: 'basic_auth', label: 'Basic Auth' },
    { value: 'custom', label: 'Custom' }
  ]},
  { key: 'api_endpoint', label: 'API Base URL', category: 'Authentication', type: 'text', placeholder: 'https://api.courier.com', description: 'The base URL for all API calls' },
  { key: 'api_key', label: 'API Key / Token', category: 'Authentication', type: 'password', placeholder: 'Enter API key or token' },
  { key: 'api_key_header', label: 'API Key Header Name', category: 'Authentication', type: 'text', placeholder: 'e.g., X-API-Key', description: 'The header name to use for the API key', dependsOn: { field: 'auth_type', value: 'api_key_header' } },
  { key: 'api_username', label: 'API Username', category: 'Authentication', type: 'text', placeholder: 'Enter username', dependsOn: { field: 'auth_type', value: 'basic_auth' } },
  { key: 'api_password', label: 'API Password', category: 'Authentication', type: 'password', placeholder: 'Enter password', dependsOn: { field: 'auth_type', value: 'basic_auth' } },
  { key: 'pickup_address_code', label: 'Pickup Address Code', category: 'Authentication', type: 'text', placeholder: 'e.g., PKC123456', description: 'Required by some couriers for bookings' },
  
  // Endpoints
  { key: 'booking_endpoint', label: 'Booking Endpoint', category: 'Endpoints', type: 'text', placeholder: 'https://api.courier.com/booking' },
  { key: 'tracking_endpoint', label: 'Tracking Endpoint', category: 'Endpoints', type: 'text', placeholder: 'https://api.courier.com/tracking/{tracking_id}' },
  { key: 'label_endpoint', label: 'Label Endpoint', category: 'Endpoints', type: 'text', placeholder: 'https://api.courier.com/label/{tracking_id}' },
  { key: 'cancellation_endpoint', label: 'Cancellation Endpoint', category: 'Endpoints', type: 'text', placeholder: 'https://api.courier.com/cancel' },
  { key: 'update_endpoint', label: 'Update Endpoint', category: 'Endpoints', type: 'text', placeholder: 'https://api.courier.com/update' },
  { key: 'rates_endpoint', label: 'Rates Endpoint', category: 'Endpoints', type: 'text', placeholder: 'https://api.courier.com/rates' },
  { key: 'bulk_booking_endpoint', label: 'Bulk Booking Endpoint', category: 'Endpoints', type: 'text', placeholder: 'https://api.courier.com/bulk-booking', description: 'For booking multiple orders at once' },
  { key: 'bulk_tracking_endpoint', label: 'Bulk Tracking Endpoint', category: 'Endpoints', type: 'text', placeholder: 'https://api.courier.com/bulk-tracking', description: 'For tracking multiple orders at once' },
  { key: 'load_sheet_endpoint', label: 'Load Sheet/Manifest Endpoint', category: 'Endpoints', type: 'text', placeholder: 'https://api.courier.com/load-sheet', description: 'For generating courier load sheets' },
  { key: 'awb_endpoint', label: 'AWB/Invoice Endpoint', category: 'Endpoints', type: 'text', placeholder: 'https://api.courier.com/awb', description: 'For fetching airway bills and invoices' },
  { key: 'shipper_advice_list_endpoint', label: 'Shipper Advice List Endpoint', category: 'Endpoints', type: 'text', placeholder: 'https://api.courier.com/shipper-advice-list', description: 'For fetching shipper advice history' },
  { key: 'shipper_advice_save_endpoint', label: 'Shipper Advice Save Endpoint', category: 'Endpoints', type: 'text', placeholder: 'https://api.courier.com/shipper-advice', description: 'For saving shipper advice (reattempt/return)' },
  { key: 'tariff_endpoint', label: 'Tariff/Pricing Endpoint', category: 'Endpoints', type: 'text', placeholder: 'https://api.courier.com/tariff', description: 'Alternative rates endpoint for pricing' },
  
  // Settings
  { key: 'label_format', label: 'Label Format', category: 'Settings', type: 'select', options: [
    { value: 'pdf', label: 'PDF' },
    { value: 'png', label: 'PNG' },
    { value: 'html', label: 'HTML' },
    { value: 'url', label: 'URL' }
  ]},
  { key: 'auto_download_label', label: 'Auto-download on booking', category: 'Settings', type: 'switch' },
];

interface Props {
  courier?: CourierConfig;
  onSave: (config: CourierConfig) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onTest?: (config: CourierConfig) => Promise<boolean>;
}

export function CourierConfigCard({ courier, onSave, onDelete, onTest }: Props) {
  const { toast } = useToast();
  const [config, setConfig] = useState<CourierConfig>(courier || {
    name: '',
    code: '',
    is_active: true,
  });
  const [activeFields, setActiveFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  // Initialize active fields based on existing courier data
  useEffect(() => {
    if (courier) {
      const fieldsWithValues = COURIER_FIELDS
        .filter(field => {
          const value = courier[field.key];
          return value !== undefined && value !== null && value !== '';
        })
        .map(field => field.key);
      setActiveFields(fieldsWithValues);
    }
  }, [courier]);

  const cleanEndpointUrl = (url: string): string => {
    if (!url) return url;
    let cleaned = url.trim().replace(/^mock(https?:\/\/.*)$/i, '$1');
    return cleaned;
  };

  const handleSave = async () => {
    if (!config.name || !config.code) {
      toast({
        title: "Validation Error",
        description: "Courier name and code are required",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Clean all endpoint URLs before saving
      const cleanedConfig = { ...config };
      const endpointFields = COURIER_FIELDS.filter(f => f.category === 'Endpoints').map(f => f.key);
      
      endpointFields.forEach(key => {
        const value = cleanedConfig[key];
        if (typeof value === 'string') {
          (cleanedConfig as any)[key] = cleanEndpointUrl(value);
        }
      });
      
      if (cleanedConfig.api_endpoint) {
        cleanedConfig.api_endpoint = cleanEndpointUrl(cleanedConfig.api_endpoint);
      }
      
      await onSave(cleanedConfig);
      toast({
        title: "Success",
        description: "Courier configuration saved"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!onTest) return;
    
    setTesting(true);
    try {
      const success = await onTest(config);
      toast({
        title: success ? "Connection Successful" : "Connection Failed",
        description: success ? "Courier API is reachable" : "Unable to connect to courier API",
        variant: success ? "default" : "destructive"
      });
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!courier?.id || !onDelete) return;
    
    if (!confirm('Are you sure you want to delete this courier?')) return;
    
    setLoading(true);
    try {
      await onDelete(courier.id);
      toast({
        title: "Success",
        description: "Courier deleted"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addField = (fieldKey: string) => {
    if (!activeFields.includes(fieldKey)) {
      setActiveFields([...activeFields, fieldKey]);
      
      // Set default value for certain field types
      const field = COURIER_FIELDS.find(f => f.key === fieldKey);
      if (field?.type === 'switch') {
        setConfig({ ...config, [fieldKey]: true });
      } else if (field?.type === 'select' && field.options?.length) {
        setConfig({ ...config, [fieldKey]: field.options[0].value });
      }
    }
  };

  const removeField = (fieldKey: string) => {
    setActiveFields(activeFields.filter(f => f !== fieldKey));
    // Clear the value when removing
    setConfig({ ...config, [fieldKey]: undefined });
  };

  const getAvailableFields = () => {
    return COURIER_FIELDS.filter(field => {
      // Don't show already added fields
      if (activeFields.includes(field.key)) return false;
      
      // Check dependencies
      if (field.dependsOn) {
        const dependentFieldActive = activeFields.includes(field.dependsOn.field);
        const dependentFieldValue = config[field.dependsOn.field];
        if (!dependentFieldActive || dependentFieldValue !== field.dependsOn.value) {
          return false;
        }
      }
      
      return true;
    });
  };

  const groupedAvailableFields = () => {
    const available = getAvailableFields();
    const grouped: Record<string, FieldDefinition[]> = {
      'Authentication': [],
      'Endpoints': [],
      'Settings': []
    };
    
    available.forEach(field => {
      grouped[field.category].push(field);
    });
    
    return grouped;
  };

  const renderField = (field: FieldDefinition) => {
    const value = config[field.key];
    
    // Check if field should be shown based on dependencies
    if (field.dependsOn) {
      const dependentValue = config[field.dependsOn.field];
      if (dependentValue !== field.dependsOn.value) {
        return null;
      }
    }
    
    return (
      <div key={field.key} className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg border border-border/50">
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{field.label}</Label>
          </div>
          
          {field.type === 'text' && (
            <Input
              value={(value as string) || ''}
              onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
              placeholder={field.placeholder}
              className="h-9"
            />
          )}
          
          {field.type === 'password' && (
            <Input
              type="password"
              value={(value as string) || ''}
              onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
              placeholder={field.placeholder}
              className="h-9"
            />
          )}
          
          {field.type === 'select' && field.options && (
            <Select
              value={(value as string) || field.options[0]?.value}
              onValueChange={(val) => setConfig({ ...config, [field.key]: val })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {field.options.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {field.type === 'switch' && (
            <div className="flex items-center space-x-2 pt-1">
              <Switch
                checked={value as boolean ?? true}
                onCheckedChange={(checked) => setConfig({ ...config, [field.key]: checked })}
              />
              <span className="text-sm text-muted-foreground">
                {value ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          )}
          
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => removeField(field.key)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  const grouped = groupedAvailableFields();
  const hasAvailableFields = Object.values(grouped).some(fields => fields.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{courier ? 'Edit Courier' : 'Add New Courier'}</span>
          <div className="flex gap-2">
            {onTest && (
              <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
                <TestTube className="h-4 w-4 mr-1" />
                Test
              </Button>
            )}
            {courier && onDelete && (
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={loading}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Essential fields - always visible */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Courier Name *</Label>
            <Input
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="e.g., TCS Express"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Courier Code *</Label>
            <Input
              value={config.code}
              onChange={(e) => setConfig({ ...config, code: e.target.value.toUpperCase() })}
              placeholder="e.g., TCS"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={config.is_active}
            onCheckedChange={(checked) => setConfig({ ...config, is_active: checked })}
          />
          <Label>Active</Label>
        </div>

        {/* Dynamic fields */}
        {activeFields.length > 0 && (
          <div className="space-y-3 pt-2">
            <Label className="text-sm text-muted-foreground">Configuration Fields</Label>
            {activeFields.map(fieldKey => {
              const field = COURIER_FIELDS.find(f => f.key === fieldKey);
              if (!field) return null;
              return renderField(field);
            })}
          </div>
        )}

        {/* Add Field Button */}
        {hasAvailableFields && (
          <div className="pt-2">
            <Select onValueChange={addField}>
              <SelectTrigger className="w-full border-dashed">
                <div className="flex items-center text-muted-foreground">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </div>
              </SelectTrigger>
              <SelectContent>
                {grouped['Authentication'].length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Authentication</SelectLabel>
                    {grouped['Authentication'].map(field => (
                      <SelectItem key={field.key} value={field.key}>{field.label}</SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {grouped['Endpoints'].length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Endpoints</SelectLabel>
                    {grouped['Endpoints'].map(field => (
                      <SelectItem key={field.key} value={field.key}>{field.label}</SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {grouped['Settings'].length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Settings</SelectLabel>
                    {grouped['Settings'].map(field => (
                      <SelectItem key={field.key} value={field.key}>{field.label}</SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button onClick={handleSave} disabled={loading} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Configuration'}
        </Button>
      </CardContent>
    </Card>
  );
}
