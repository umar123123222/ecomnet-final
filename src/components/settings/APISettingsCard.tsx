import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Key, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface APISettingsCardProps {
  isSuperAdmin: boolean;
}

interface APIConfig {
  name: string;
  description: string;
  secretKey: string;
}

const apiConfigs: Record<string, APIConfig[]> = {
  'WhatsApp Integration': [
    {
      name: 'WhatsApp Access Token',
      description: 'Access token for WhatsApp Business API',
      secretKey: 'WHATSAPP_ACCESS_TOKEN'
    },
    {
      name: 'WhatsApp Phone Number ID',
      description: 'Phone number ID for WhatsApp messages',
      secretKey: 'WHATSAPP_PHONE_NUMBER_ID'
    }
  ],
  'Courier APIs': [
    {
      name: 'TCS API Key',
      description: 'API key for TCS courier integration',
      secretKey: 'TCS_API_KEY'
    },
    {
      name: 'Leopard API Key',
      description: 'API key for Leopard courier integration',
      secretKey: 'LEOPARD_API_KEY'
    },
    {
      name: 'PostEx API Key',
      description: 'API key for PostEx courier integration',
      secretKey: 'POSTEX_API_KEY'
    }
  ],
  'Shopify Integration': [
    {
      name: 'Shopify Store URL',
      description: 'Your Shopify store URL',
      secretKey: 'SHOPIFY_STORE_URL'
    },
    {
      name: 'Shopify Admin API Token',
      description: 'Admin API access token for Shopify',
      secretKey: 'SHOPIFY_ADMIN_API_TOKEN'
    },
    {
      name: 'Shopify Webhook Secret',
      description: 'Webhook verification secret',
      secretKey: 'SHOPIFY_WEBHOOK_SECRET'
    },
    {
      name: 'Shopify API Version',
      description: 'API version for Shopify integration',
      secretKey: 'SHOPIFY_API_VERSION'
    }
  ]
};

export function APISettingsCard({ isSuperAdmin }: APISettingsCardProps) {
  if (!isSuperAdmin) {
    return null;
  }

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
              API keys and credentials are managed via Supabase secrets
            </CardDescription>
          </div>
          <Badge variant="default" className="bg-red-500">
            Super Admin Only
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="card-content space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            API keys are securely stored as environment variables in Supabase. To update any API configuration, contact your developer.
          </AlertDescription>
        </Alert>

        {Object.entries(apiConfigs).map(([groupName, configs]) => (
          <div key={groupName} className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">{groupName}</h3>
            <div className="space-y-4">
              {configs.map((config) => (
                <div key={config.secretKey} className="form-group">
                  <Label className="form-label">{config.name}</Label>
                  <div className="p-3 bg-muted rounded-md border border-border">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">{config.description}</p>
                        <p className="text-xs font-mono text-muted-foreground">
                          Secret: {config.secretKey}
                        </p>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        Contact Developer
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Security Note:</strong> All API keys are managed as Supabase secrets and are not stored in the database. 
            This ensures maximum security and prevents unauthorized access. Contact your developer to update any API credentials.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
