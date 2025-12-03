import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Save, TestTube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CourierConfig {
  id?: string;
  name: string;
  code: string;
  is_active: boolean;
  auth_type: 'bearer_token' | 'api_key_header' | 'basic_auth' | 'custom';
  api_endpoint: string;
  api_key: string;
  api_key_header?: string;
  api_username?: string;
  api_password?: string;
  pickup_address_code?: string;
  booking_endpoint: string;
  tracking_endpoint: string;
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
  label_format: 'pdf' | 'html' | 'png' | 'url';
  auto_download_label: boolean;
  auth_config?: any;
}

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
    auth_type: 'bearer_token',
    api_endpoint: '',
    api_key: '',
    api_key_header: '',
    api_username: '',
    api_password: '',
    pickup_address_code: '',
    booking_endpoint: '',
    tracking_endpoint: '',
    label_format: 'pdf',
    auto_download_label: true
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const cleanEndpointUrl = (url: string): string => {
    if (!url) return url;
    // Strip 'mock' prefix if it appears before http/https
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
      const cleanedConfig = {
        ...config,
        api_endpoint: cleanEndpointUrl(config.api_endpoint),
        booking_endpoint: cleanEndpointUrl(config.booking_endpoint),
        tracking_endpoint: cleanEndpointUrl(config.tracking_endpoint),
        label_endpoint: config.label_endpoint ? cleanEndpointUrl(config.label_endpoint) : config.label_endpoint,
        cancellation_endpoint: config.cancellation_endpoint ? cleanEndpointUrl(config.cancellation_endpoint) : config.cancellation_endpoint,
        update_endpoint: config.update_endpoint ? cleanEndpointUrl(config.update_endpoint) : config.update_endpoint,
        rates_endpoint: config.rates_endpoint ? cleanEndpointUrl(config.rates_endpoint) : config.rates_endpoint,
        bulk_booking_endpoint: config.bulk_booking_endpoint ? cleanEndpointUrl(config.bulk_booking_endpoint) : config.bulk_booking_endpoint,
        bulk_tracking_endpoint: config.bulk_tracking_endpoint ? cleanEndpointUrl(config.bulk_tracking_endpoint) : config.bulk_tracking_endpoint,
        load_sheet_endpoint: config.load_sheet_endpoint ? cleanEndpointUrl(config.load_sheet_endpoint) : config.load_sheet_endpoint,
        awb_endpoint: config.awb_endpoint ? cleanEndpointUrl(config.awb_endpoint) : config.awb_endpoint,
        shipper_advice_list_endpoint: config.shipper_advice_list_endpoint ? cleanEndpointUrl(config.shipper_advice_list_endpoint) : config.shipper_advice_list_endpoint,
        shipper_advice_save_endpoint: config.shipper_advice_save_endpoint ? cleanEndpointUrl(config.shipper_advice_save_endpoint) : config.shipper_advice_save_endpoint,
        tariff_endpoint: config.tariff_endpoint ? cleanEndpointUrl(config.tariff_endpoint) : config.tariff_endpoint
      };
      
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
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Courier Name</Label>
            <Input
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="e.g., TCS Express"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Courier Code</Label>
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

        <div className="space-y-2">
          <Label>Authentication Type</Label>
          <Select
            value={config.auth_type}
            onValueChange={(value: any) => setConfig({ ...config, auth_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bearer_token">Bearer Token</SelectItem>
              <SelectItem value="api_key_header">API Key Header</SelectItem>
              <SelectItem value="basic_auth">Basic Auth</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>API Base URL</Label>
          <Input
            value={config.api_endpoint}
            onChange={(e) => setConfig({ ...config, api_endpoint: e.target.value })}
            placeholder="https://api.courier.com"
          />
          <p className="text-xs text-muted-foreground">
            The base URL for all API calls (without trailing slash)
          </p>
        </div>

        {config.auth_type === 'api_key_header' && (
          <div className="space-y-2">
            <Label>API Key Header Name</Label>
            <Input
              value={config.api_key_header || ''}
              onChange={(e) => setConfig({ ...config, api_key_header: e.target.value })}
              placeholder="e.g., X-API-Key, Api-Key, Authorization"
            />
            <p className="text-xs text-muted-foreground">
              The header name to use for the API key
            </p>
          </div>
        )}

        {config.auth_type === 'basic_auth' ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>API Username</Label>
              <Input
                value={config.api_username || ''}
                onChange={(e) => setConfig({ ...config, api_username: e.target.value })}
                placeholder="Enter username"
              />
            </div>
            <div className="space-y-2">
              <Label>API Password</Label>
              <Input
                type="password"
                value={config.api_password || ''}
                onChange={(e) => setConfig({ ...config, api_password: e.target.value })}
                placeholder="Enter password"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>API Key / Token</Label>
            <Input
              type="password"
              value={config.api_key}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              placeholder="Enter API key or token"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Pickup Address Code (Optional)</Label>
          <Input
            value={config.pickup_address_code || ''}
            onChange={(e) => setConfig({ ...config, pickup_address_code: e.target.value })}
            placeholder="e.g., PKC123456 (if required by courier)"
          />
          <p className="text-xs text-muted-foreground">
            Some couriers require a pickup address code for bookings
          </p>
        </div>

        <div className="space-y-2">
          <Label>Booking Endpoint URL</Label>
          <Input
            value={config.booking_endpoint}
            onChange={(e) => setConfig({ ...config, booking_endpoint: e.target.value })}
            placeholder="https://api.courier.com/booking"
          />
        </div>

        <div className="space-y-2">
          <Label>Tracking Endpoint URL</Label>
          <Input
            value={config.tracking_endpoint}
            onChange={(e) => setConfig({ ...config, tracking_endpoint: e.target.value })}
            placeholder="https://api.courier.com/tracking/{tracking_id}"
          />
        </div>

        <div className="space-y-2">
          <Label>Label Endpoint URL (Optional)</Label>
          <Input
            value={config.label_endpoint || ''}
            onChange={(e) => setConfig({ ...config, label_endpoint: e.target.value })}
            placeholder="https://api.courier.com/label/{tracking_id}"
          />
        </div>

        <div className="space-y-2">
          <Label>Cancellation Endpoint URL (Optional)</Label>
          <Input
            value={config.cancellation_endpoint || ''}
            onChange={(e) => setConfig({ ...config, cancellation_endpoint: e.target.value })}
            placeholder="https://api.courier.com/cancel"
          />
        </div>

        <div className="space-y-2">
          <Label>Update Endpoint URL (Optional)</Label>
          <Input
            value={config.update_endpoint || ''}
            onChange={(e) => setConfig({ ...config, update_endpoint: e.target.value })}
            placeholder="https://api.courier.com/update"
          />
        </div>

        <div className="space-y-2">
          <Label>Rates Endpoint URL (Optional)</Label>
          <Input
            value={config.rates_endpoint || ''}
            onChange={(e) => setConfig({ ...config, rates_endpoint: e.target.value })}
            placeholder="https://api.courier.com/rates"
          />
        </div>

        <div className="space-y-2">
          <Label>Bulk Booking Endpoint (Optional)</Label>
          <p className="text-xs text-muted-foreground">For booking multiple orders at once</p>
          <Input
            value={config.bulk_booking_endpoint || ''}
            onChange={(e) => setConfig({ ...config, bulk_booking_endpoint: e.target.value })}
            placeholder="https://api.courier.com/bulk-booking"
          />
        </div>

        <div className="space-y-2">
          <Label>Bulk Tracking Endpoint (Optional)</Label>
          <p className="text-xs text-muted-foreground">For tracking multiple orders at once</p>
          <Input
            value={config.bulk_tracking_endpoint || ''}
            onChange={(e) => setConfig({ ...config, bulk_tracking_endpoint: e.target.value })}
            placeholder="https://api.courier.com/bulk-tracking"
          />
        </div>

        <div className="space-y-2">
          <Label>Load Sheet/Manifest Endpoint (Optional)</Label>
          <p className="text-xs text-muted-foreground">For generating courier load sheets</p>
          <Input
            value={config.load_sheet_endpoint || ''}
            onChange={(e) => setConfig({ ...config, load_sheet_endpoint: e.target.value })}
            placeholder="https://api.courier.com/load-sheet"
          />
        </div>

        <div className="space-y-2">
          <Label>AWB/Invoice Endpoint (Optional)</Label>
          <p className="text-xs text-muted-foreground">For fetching airway bills and invoices</p>
          <Input
            value={config.awb_endpoint || ''}
            onChange={(e) => setConfig({ ...config, awb_endpoint: e.target.value })}
            placeholder="https://api.courier.com/awb"
          />
        </div>

        <div className="space-y-2">
          <Label>Shipper Advice List Endpoint (Optional)</Label>
          <p className="text-xs text-muted-foreground">For fetching shipper advice history</p>
          <Input
            value={config.shipper_advice_list_endpoint || ''}
            onChange={(e) => setConfig({ ...config, shipper_advice_list_endpoint: e.target.value })}
            placeholder="https://api.courier.com/shipper-advice-list"
          />
        </div>

        <div className="space-y-2">
          <Label>Shipper Advice Save Endpoint (Optional)</Label>
          <p className="text-xs text-muted-foreground">For saving shipper advice (reattempt/return)</p>
          <Input
            value={config.shipper_advice_save_endpoint || ''}
            onChange={(e) => setConfig({ ...config, shipper_advice_save_endpoint: e.target.value })}
            placeholder="https://api.courier.com/shipper-advice"
          />
        </div>

        <div className="space-y-2">
          <Label>Tariff/Pricing Endpoint (Optional)</Label>
          <p className="text-xs text-muted-foreground">Alternative rates endpoint for pricing calculations</p>
          <Input
            value={config.tariff_endpoint || ''}
            onChange={(e) => setConfig({ ...config, tariff_endpoint: e.target.value })}
            placeholder="https://api.courier.com/tariff"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Label Format</Label>
            <Select
              value={config.label_format}
              onValueChange={(value: any) => setConfig({ ...config, label_format: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="url">URL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2 pt-8">
            <Switch
              checked={config.auto_download_label}
              onCheckedChange={(checked) => setConfig({ ...config, auto_download_label: checked })}
            />
            <Label>Auto-download on booking</Label>
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Configuration'}
        </Button>
      </CardContent>
    </Card>
  );
}
