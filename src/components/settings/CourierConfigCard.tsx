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
  api_key: string;
  booking_endpoint: string;
  tracking_endpoint: string;
  label_endpoint?: string;
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
    api_key: '',
    booking_endpoint: '',
    tracking_endpoint: '',
    label_format: 'pdf',
    auto_download_label: true
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

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
      await onSave(config);
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
          <Label>API Key / Token</Label>
          <Input
            type="password"
            value={config.api_key}
            onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
            placeholder="Enter API key or token"
          />
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
