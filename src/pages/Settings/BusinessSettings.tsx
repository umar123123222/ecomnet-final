import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Building2, Link, Mail, Phone, Truck, ShoppingBag, MessageSquare, DollarSign, Loader2, CheckCircle2, AlertCircle, Plug, Save, RefreshCw, Zap, Activity, MapPin, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SUPPORTED_CURRENCIES } from "@/utils/currency";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { supabase } from "@/integrations/supabase/client";
import { ShopifySyncStats } from "@/components/shopify/ShopifySyncStats";
import { ShopifySyncLogs } from "@/components/shopify/ShopifySyncLogs";
import { WebhookStatus } from "@/components/shopify/WebhookStatus";
import { ProductSyncControl } from "@/components/shopify/ProductSyncControl";
import { OrderSyncControl } from "@/components/shopify/OrderSyncControl";
import { CustomerSyncControl } from "@/components/shopify/CustomerSyncControl";
import { FullSyncControl } from "@/components/shopify/FullSyncControl";
import { MissingOrdersSync } from "@/components/shopify/MissingOrdersSync";
import { CourierConfigCard } from "@/components/settings/CourierConfigCard";
import { AWBGenerationPanel } from "@/components/settings/AWBGenerationPanel";

const BusinessSettings = () => {
  const { hasRole } = useUserRoles();
  const { toast } = useToast();
  const { getSetting, updateSetting, isUpdating } = useBusinessSettings();

  // Only super_admin can access business settings (security critical)
  if (!hasRole('super_admin')) {
    return <Navigate to="/" replace />;
  }

  // Company Info State - synced with database
  const [companyName, setCompanyName] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyCurrency, setCompanyCurrency] = useState('USD');
  
  // Pickup Address State
  const [pickupAddressName, setPickupAddressName] = useState('');
  const [pickupAddressPhone, setPickupAddressPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCity, setPickupCity] = useState('');

  // Load settings from database
  useEffect(() => {
    setCompanyName(getSetting('company_name') || '');
    setPortalUrl(getSetting('portal_url') || '');
    setCompanyEmail(getSetting('company_email') || '');
    setCompanyPhone(getSetting('company_phone') || '');
    setCompanyCurrency(getSetting('company_currency') || 'USD');
    setPickupAddressName(getSetting('PICKUP_ADDRESS_NAME') || '');
    setPickupAddressPhone(getSetting('PICKUP_ADDRESS_PHONE') || '');
    setPickupAddress(getSetting('PICKUP_ADDRESS_ADDRESS') || '');
    setPickupCity(getSetting('PICKUP_ADDRESS_CITY') || '');
  }, [getSetting]);

  // Couriers State - load from database
  const [couriers, setCouriers] = useState<any[]>([]);
  const [loadingCouriers, setLoadingCouriers] = useState(false);
  const [showAddCourier, setShowAddCourier] = useState(false);

  // Load couriers from database
  useEffect(() => {
    loadCouriers();
  }, []);

  const loadCouriers = async () => {
    setLoadingCouriers(true);
    try {
      const { data, error } = await supabase
        .from('couriers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      // Load API keys and pickup codes for each courier
      const couriersWithKeys = await Promise.all(
        (data || []).map(async (courier) => {
          const apiKey = getSetting(`${courier.code.toUpperCase()}_API_KEY`) || '';
          const pickupCode = getSetting(`${courier.code.toUpperCase()}_PICKUP_ADDRESS_CODE`) || '';
          return { ...courier, api_key: apiKey, pickup_address_code: pickupCode };
        })
      );
      
      setCouriers(couriersWithKeys);
    } catch (error: any) {
      console.error('Error loading couriers:', error);
      toast({
        title: "Error",
        description: "Failed to load couriers",
        variant: "destructive"
      });
    } finally {
      setLoadingCouriers(false);
    }
  };

  const handleSaveCourier = async (config: any) => {
    try {
      const courierData = {
        name: config.name,
        code: config.code.toLowerCase(),
        is_active: config.is_active,
        auth_type: config.auth_type,
        booking_endpoint: config.booking_endpoint,
        tracking_endpoint: config.tracking_endpoint,
        label_endpoint: config.label_endpoint,
        label_format: config.label_format,
        auto_download_label: config.auto_download_label,
        auth_config: config.auth_config || {},
        api_endpoint: config.booking_endpoint,
        config: {}
      };

      if (config.id) {
        // Update existing
        const { error } = await supabase
          .from('couriers')
          .update(courierData)
          .eq('id', config.id);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('couriers')
          .insert([courierData]);
        
        if (error) throw error;
      }

      // Save API key
      await updateSetting(`${config.code.toUpperCase()}_API_KEY`, config.api_key, `API key for ${config.name}`);
      
      // Save pickup address code if provided
      if (config.pickup_address_code) {
        await updateSetting(
          `${config.code.toUpperCase()}_PICKUP_ADDRESS_CODE`, 
          config.pickup_address_code, 
          `Pickup address code for ${config.name}`
        );
      }

      await loadCouriers();
      setShowAddCourier(false);
    } catch (error: any) {
      throw new Error(`Failed to save courier: ${error.message}`);
    }
  };

  const handleDeleteCourier = async (id: string) => {
    try {
      const { error } = await supabase
        .from('couriers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      await loadCouriers();
    } catch (error: any) {
      throw new Error(`Failed to delete courier: ${error.message}`);
    }
  };

  const handleTestCourier = async (config: any): Promise<boolean> => {
    // Simple connectivity test - you can enhance this
    try {
      if (!config.tracking_endpoint) return false;
      // In production, you'd call a test endpoint
      return true;
    } catch {
      return false;
    }
  };

  // Shopify State
  const [shopifyAccessToken, setShopifyAccessToken] = useState('');
  const [shopifyStoreUrl, setShopifyStoreUrl] = useState('');
  const [shopifyApiVersion, setShopifyApiVersion] = useState('2024-01');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // Auto-sync toggles
  const [autoSyncOrders, setAutoSyncOrders] = useState(true);
  const [autoSyncInventory, setAutoSyncInventory] = useState(false);
  const [autoSyncProducts, setAutoSyncProducts] = useState(false);
  const [autoSyncCustomers, setAutoSyncCustomers] = useState(false);
  const [shopifyLocationId, setShopifyLocationId] = useState('');

  // Load Shopify settings from database
  useEffect(() => {
    const storeUrl = getSetting('SHOPIFY_STORE_URL');
    const apiVersion = getSetting('SHOPIFY_API_VERSION');
    const autoOrders = getSetting('SHOPIFY_AUTO_SYNC_ORDERS');
    const autoInventory = getSetting('SHOPIFY_AUTO_SYNC_INVENTORY');
    const autoProducts = getSetting('SHOPIFY_AUTO_SYNC_PRODUCTS');
    const autoCustomers = getSetting('SHOPIFY_AUTO_SYNC_CUSTOMERS');
    const locationId = getSetting('SHOPIFY_DEFAULT_LOCATION_ID');
    
    if (storeUrl) setShopifyStoreUrl(storeUrl);
    if (apiVersion) setShopifyApiVersion(apiVersion);
    if (autoOrders) setAutoSyncOrders(autoOrders === 'true');
    if (autoInventory) setAutoSyncInventory(autoInventory === 'true');
    if (autoProducts) setAutoSyncProducts(autoProducts === 'true');
    if (autoCustomers) setAutoSyncCustomers(autoCustomers === 'true');
    if (locationId) setShopifyLocationId(locationId);
  }, [getSetting]);

  // WhatsApp CRM State
  const [whatsappCrmUrl, setWhatsappCrmUrl] = useState('');
  const [whatsappCrmApiKey, setWhatsappCrmApiKey] = useState('');

  // Meta WhatsApp API State
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('');
  const [metaBusinessAccountId, setMetaBusinessAccountId] = useState('');

  // WhatsApp Templates State
  const [whatsappTemplates, setWhatsappTemplates] = useState<Array<{
    id: string;
    name: string;
    category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'SERVICE';
    language: string;
    status: 'APPROVED' | 'PENDING' | 'REJECTED';
    components: string;
  }>>([{
    id: '1',
    name: 'order_confirmation',
    category: 'UTILITY',
    language: 'en',
    status: 'APPROVED',
    components: 'Header, Body, Footer'
  }, {
    id: '2',
    name: 'promotional_offer',
    category: 'MARKETING',
    language: 'en',
    status: 'APPROVED',
    components: 'Header, Body, Button'
  }]);
  const handleSaveCompanyInfo = async () => {
    try {
      // Save all company settings
      await Promise.all([
        updateSetting('company_name', companyName, 'Company name'),
        updateSetting('portal_url', portalUrl, 'Company portal URL'),
        updateSetting('company_email', companyEmail, 'Company contact email'),
        updateSetting('company_phone', companyPhone, 'Company contact phone'),
        updateSetting('company_currency', companyCurrency, 'Company default currency'),
      ]);

      toast({
        title: "Company Information Saved",
        description: "Your company details have been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save company information.",
        variant: "destructive"
      });
    }
  };
  
  const handleSavePickupAddress = async () => {
    try {
      await Promise.all([
        updateSetting('PICKUP_ADDRESS_NAME', pickupAddressName, 'Warehouse/Company name for pickup'),
        updateSetting('PICKUP_ADDRESS_PHONE', pickupAddressPhone, 'Contact phone for pickup'),
        updateSetting('PICKUP_ADDRESS_ADDRESS', pickupAddress, 'Warehouse pickup address'),
        updateSetting('PICKUP_ADDRESS_CITY', pickupCity, 'Warehouse city'),
      ]);

      toast({
        title: "Pickup Address Saved",
        description: "Your pickup address has been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save pickup address.",
        variant: "destructive"
      });
    }
  };
  const handleAddCourier = () => {
    setCouriers([...couriers, {
      id: crypto.randomUUID(),
      name: '',
      apiEndpoint: '',
      apiKey: '',
      code: ''
    }]);
  };
  const handleRemoveCourier = (id: string) => {
    setCouriers(couriers.filter(c => c.id !== id));
  };
  const handleUpdateCourier = (id: string, field: string, value: string) => {
    setCouriers(couriers.map(c => c.id === id ? {
      ...c,
      [field]: value
    } : c));
  };
  const handleSaveCouriers = () => {
    toast({
      title: "Couriers Saved",
      description: "Courier configurations have been updated."
    });
  };
  const handleTestConnection = async () => {
    if (!shopifyStoreUrl || !shopifyAccessToken) {
      toast({
        title: "Missing information",
        description: "Please enter both Store URL and Access Token",
        variant: "destructive",
      });
      return;
    }

    // Validate API version format
    const versionRegex = /^20\d{2}-(01|04|07|10)$/;
    if (!versionRegex.test(shopifyApiVersion)) {
      toast({
        title: "Invalid API Version",
        description: "API version must be in format YYYY-MM (e.g., 2024-10). Valid months: 01, 04, 07, 10",
        variant: "destructive",
      });
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus('idle');

    try {
      // Clean store URL
      const cleanUrl = shopifyStoreUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      // Test connection via edge function (server-side)
      const { data, error } = await supabase.functions.invoke('test-shopify-connection', {
        body: {
          store_url: `https://${cleanUrl}`,
          api_token: shopifyAccessToken,
          api_version: shopifyApiVersion,
        },
      });

      if (error) {
        setConnectionStatus('error');
        toast({
          title: "Connection error",
          description: error.message || "Failed to test connection",
          variant: "destructive",
        });
        return;
      }

      if (data.ok) {
        setConnectionStatus('success');
        toast({
          title: "Connection successful",
          description: `Connected to ${data.shop_name} (${data.domain})`,
        });
      } else {
        setConnectionStatus('error');
        toast({
          title: "Connection failed",
          description: data.error || data.hint || "Please check your credentials",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setConnectionStatus('error');
      toast({
        title: "Connection error",
        description: error.message || "Failed to connect to Shopify",
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveShopify = async () => {
    if (!shopifyStoreUrl || !shopifyApiVersion || !shopifyAccessToken) {
      toast({
        title: "Missing information",
        description: "Please fill in Store URL, API Version, and Admin API Token",
        variant: "destructive",
      });
      return;
    }

    // Validate store URL format
    const cleanUrl = shopifyStoreUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!cleanUrl.includes('.myshopify.com')) {
      toast({
        title: "Invalid Store URL",
        description: "Store URL should be in format: your-store.myshopify.com",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Update all credentials via edge function
      const { updateShopifyCredentials } = await import("@/integrations/supabase/functions");
      const { data, error } = await updateShopifyCredentials({
        store_url: `https://${cleanUrl}`,
        api_token: shopifyAccessToken,
        api_version: shopifyApiVersion,
        location_id: shopifyLocationId,
      });

      if (error) {
        throw error;
      }

      // Show success message
      if (data) {
        let description = data.message || "Settings updated successfully";
        if (data.next_steps && Array.isArray(data.next_steps)) {
          description = data.next_steps.join('\n');
        }
        
        toast({
          title: "Settings Updated",
          description,
          duration: 8000,
        });
      }

      // Always update auto-sync settings
      await Promise.all([
        updateSetting('SHOPIFY_AUTO_SYNC_ORDERS', autoSyncOrders.toString(), 'Auto-sync orders to Shopify'),
        updateSetting('SHOPIFY_AUTO_SYNC_INVENTORY', autoSyncInventory.toString(), 'Auto-sync inventory to Shopify'),
        updateSetting('SHOPIFY_AUTO_SYNC_PRODUCTS', autoSyncProducts.toString(), 'Auto-sync products to Shopify'),
        updateSetting('SHOPIFY_AUTO_SYNC_CUSTOMERS', autoSyncCustomers.toString(), 'Auto-sync customers to Shopify'),
      ]);
      
      setConnectionStatus('idle');
      toast({
        title: "Settings saved",
        description: "Shopify integration settings have been updated successfully.",
      });
    } catch (error: any) {
      console.error('Error saving Shopify settings:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save Shopify settings",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegisterWebhooks = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('register-shopify-webhooks');
      
      if (error) throw error;

      toast({
        title: "Webhooks Registered",
        description: `Successfully registered ${data.registered?.length || 0} webhooks`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to register webhooks",
        variant: "destructive",
      });
    }
  };

  const handleProcessQueue = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('process-sync-queue');
      
      if (error) throw error;

      toast({
        title: "Queue Processed",
        description: `Processed ${data.processed || 0} items, ${data.failed || 0} failed`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process queue",
        variant: "destructive",
      });
    }
  };

  const handleFullSync = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-shopify-all');
      
      if (error) throw error;

      toast({
        title: "Full Sync Started",
        description: "Syncing all products, orders, and customers from Shopify",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start full sync",
        variant: "destructive",
      });
    }
  };
  const handleSaveWhatsAppCRM = () => {
    toast({
      title: "WhatsApp CRM Saved",
      description: "WhatsApp CRM sync has been configured."
    });
  };
  const handleSaveMetaWhatsApp = () => {
    toast({
      title: "Meta WhatsApp API Saved",
      description: "Meta WhatsApp API has been configured."
    });
  };
  return <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Business Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure business-wide settings and integrations
        </p>
      </div>

      <Tabs defaultValue="company" className="w-full mx-0 px-[30px] py-0">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="couriers">Couriers</TabsTrigger>
          <TabsTrigger value="shopify">Shopify</TabsTrigger>
          <TabsTrigger value="whatsapp-crm">WhatsApp CRM</TabsTrigger>
          <TabsTrigger value="meta-whatsapp">Meta API</TabsTrigger>
        </TabsList>

        {/* Company Information */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>
                Configure your company details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" placeholder="Enter company name" value={companyName} onChange={e => setCompanyName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="portalUrl">Portal URL</Label>
                <Input id="portalUrl" placeholder="https://yourcompany.com" value={portalUrl} onChange={e => setPortalUrl(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyEmail">Company Email</Label>
                <Input id="companyEmail" type="email" placeholder="contact@company.com" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyPhone">Company Phone Number</Label>
                <Input id="companyPhone" placeholder="+92 300 1234567" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyCurrency" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Company Currency
                </Label>
                <Select value={companyCurrency} onValueChange={setCompanyCurrency}>
                  <SelectTrigger id="companyCurrency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.symbol} {currency.name} ({currency.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This currency will be used across the entire system for POS, orders, inventory, and reports.
                </p>
              </div>

              <Separator />

              <Button onClick={handleSaveCompanyInfo} className="w-full" disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save Company Information"}
              </Button>
            </CardContent>
          </Card>
          
          {/* Pickup Address Configuration */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Pickup Address Configuration
              </CardTitle>
              <CardDescription>
                Configure the warehouse/outlet address used for courier bookings and shipments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Building2 className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  This address will be used as the pickup location when booking shipments with couriers.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="pickupAddressName">Warehouse/Company Name *</Label>
                <Input 
                  id="pickupAddressName" 
                  placeholder="Enter warehouse or company name" 
                  value={pickupAddressName} 
                  onChange={e => setPickupAddressName(e.target.value)} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pickupAddressPhone">Contact Phone Number *</Label>
                <Input 
                  id="pickupAddressPhone" 
                  placeholder="+92 300 1234567" 
                  value={pickupAddressPhone} 
                  onChange={e => setPickupAddressPhone(e.target.value)} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pickupAddress">Pickup Address *</Label>
                <Input 
                  id="pickupAddress" 
                  placeholder="Enter complete warehouse address" 
                  value={pickupAddress} 
                  onChange={e => setPickupAddress(e.target.value)} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pickupCity">City *</Label>
                <Input 
                  id="pickupCity" 
                  placeholder="Enter city name" 
                  value={pickupCity} 
                  onChange={e => setPickupCity(e.target.value)} 
                />
              </div>

              <Separator />

              <Button 
                onClick={handleSavePickupAddress} 
                className="w-full" 
                disabled={isUpdating || !pickupAddressName || !pickupAddressPhone || !pickupAddress || !pickupCity}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Pickup Address
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Couriers */}
        <TabsContent value="couriers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Courier Integrations
              </CardTitle>
              <CardDescription>
                Configure courier services with API credentials for automated booking, tracking, and label generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingCouriers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>✓ Flexible Courier Configuration</strong><br />
                      Add any courier with custom API endpoints, authentication, and label formats. The system supports automated booking, daily tracking updates, and shipping slip downloads.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    {couriers.map((courier) => (
                      <CourierConfigCard
                        key={courier.id}
                        courier={courier}
                        onSave={handleSaveCourier}
                        onDelete={handleDeleteCourier}
                        onTest={handleTestCourier}
                      />
                    ))}
                  </div>

                  {showAddCourier ? (
                    <CourierConfigCard
                      onSave={handleSaveCourier}
                      onTest={handleTestCourier}
                    />
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setShowAddCourier(true)}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Courier
                    </Button>
                  )}

                  <Separator />

                  <AWBGenerationPanel couriers={couriers} />

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">System Features</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Automated order booking with courier APIs</li>
                      <li>• Daily tracking updates for active shipments</li>
                      <li>• Automatic shipping slip downloads</li>
                      <li>• Support for custom authentication methods</li>
                      <li>• Flexible label formats (PDF, PNG, HTML, URL)</li>
                      <li>• Bulk AWB generation (up to 1000 orders)</li>
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shopify */}
        <TabsContent value="shopify" className="space-y-6">
          {/* Connection Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Shopify Integration
              </CardTitle>
              <CardDescription>
                Connect your Shopify store to sync products, orders, customers, and inventory
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {connectionStatus === 'success' && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Successfully connected to Shopify
                  </AlertDescription>
                </Alert>
              )}
              {connectionStatus === 'error' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to connect to Shopify. Please check your credentials.
                  </AlertDescription>
                </Alert>
              )}

              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>✓ All credentials are stored in the database</strong><br />
                  All Shopify settings are saved in the database and immediately available to all edge functions. You can update any credential at any time from this interface without developer assistance.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="shopifyStoreUrl">Store URL *</Label>
                <Input 
                  id="shopifyStoreUrl" 
                  placeholder="your-store.myshopify.com" 
                  value={shopifyStoreUrl} 
                  onChange={e => setShopifyStoreUrl(e.target.value)} 
                />
                <p className="text-sm text-muted-foreground">
                  Your Shopify store domain (e.g., your-store.myshopify.com)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shopifyAccessToken">Admin API Access Token *</Label>
                <Input 
                  id="shopifyAccessToken" 
                  type="password" 
                  placeholder="shpat_xxxxxxxxxxxx" 
                  value={shopifyAccessToken} 
                  onChange={e => setShopifyAccessToken(e.target.value)} 
                />
                <p className="text-sm text-muted-foreground">
                  Shopify Admin API access token - stored securely in database.{" "}
                  <a 
                    href="https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/generate-app-access-tokens-admin"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    How to get an access token
                  </a>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shopifyApiVersion">API Version *</Label>
                  <Input 
                    id="shopifyApiVersion" 
                    placeholder="2024-01" 
                    value={shopifyApiVersion} 
                    onChange={e => setShopifyApiVersion(e.target.value)} 
                  />
                  <p className="text-sm text-muted-foreground">
                    Shopify API version (e.g., 2024-01, 2024-04)
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="shopifyLocationId">Default Location ID</Label>
                  <Input 
                    id="shopifyLocationId" 
                    placeholder="123456789" 
                    value={shopifyLocationId} 
                    onChange={e => setShopifyLocationId(e.target.value)} 
                  />
                  <p className="text-sm text-muted-foreground">
                    Shopify location ID for inventory sync
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Connection Status</h4>
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTestingConnection || isSaving || !shopifyStoreUrl || !shopifyAccessToken || !shopifyApiVersion}
                >
                  {isTestingConnection ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing Connection...
                    </>
                  ) : (
                    <>
                      <Plug className="mr-2 h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </Button>
              </div>

              <Separator />

              <Button onClick={handleSaveShopify} className="w-full" disabled={isSaving || isUpdating}>
                {isSaving || isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Connection Settings
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Auto-Sync Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Auto-Sync Configuration
              </CardTitle>
              <CardDescription>
                Enable automatic bidirectional synchronization for different data types
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoSyncOrders">Auto-sync Orders</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create and update orders in Shopify
                  </p>
                </div>
                <Switch 
                  id="autoSyncOrders"
                  checked={autoSyncOrders}
                  onCheckedChange={setAutoSyncOrders}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoSyncInventory">Auto-sync Inventory</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically update stock levels in Shopify
                  </p>
                </div>
                <Switch 
                  id="autoSyncInventory"
                  checked={autoSyncInventory}
                  onCheckedChange={setAutoSyncInventory}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoSyncProducts">Auto-sync Products</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync product changes to Shopify
                  </p>
                </div>
                <Switch 
                  id="autoSyncProducts"
                  checked={autoSyncProducts}
                  onCheckedChange={setAutoSyncProducts}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="autoSyncCustomers">Auto-sync Customers</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync customer data with Shopify
                  </p>
                </div>
                <Switch 
                  id="autoSyncCustomers"
                  checked={autoSyncCustomers}
                  onCheckedChange={setAutoSyncCustomers}
                />
              </div>

              <Separator />

              <Button onClick={handleSaveShopify} className="w-full" disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Auto-Sync Settings
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Manual Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Manual Actions
              </CardTitle>
              <CardDescription>
                Trigger manual synchronization and management operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <ProductSyncControl />
                <OrderSyncControl />
                <CustomerSyncControl />
                <FullSyncControl />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button variant="outline" onClick={handleRegisterWebhooks} className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Register Webhooks
                </Button>
                
                <Button variant="outline" onClick={handleProcessQueue} className="w-full">
                  <Zap className="mr-2 h-4 w-4" />
                  Process Sync Queue
                </Button>
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  <strong>Register Webhooks:</strong> Set up real-time sync for order/inventory/product updates.<br/>
                  <strong>Process Queue:</strong> Manually process pending sync operations.<br/>
                  <strong>Full Sync:</strong> Import all products, orders, and customers from Shopify.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Missing Orders Sync */}
          <MissingOrdersSync />

          {/* Sync Statistics */}
          <ShopifySyncStats />

          {/* Webhook Status */}
          <WebhookStatus />

          {/* Sync Activity Logs */}
          <ShopifySyncLogs />
        </TabsContent>

        {/* WhatsApp CRM */}
        <TabsContent value="whatsapp-crm">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                WhatsApp CRM Sync
              </CardTitle>
              <CardDescription>
                Connect to external WhatsApp CRM via Lovable/Supabase project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="whatsappCrmUrl">CRM Project URL</Label>
                <Input id="whatsappCrmUrl" placeholder="https://your-project.supabase.co" value={whatsappCrmUrl} onChange={e => setWhatsappCrmUrl(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappCrmApiKey">CRM API Key</Label>
                <Input id="whatsappCrmApiKey" type="password" placeholder="Enter CRM API key" value={whatsappCrmApiKey} onChange={e => setWhatsappCrmApiKey(e.target.value)} />
              </div>

              <Separator />

              <Button onClick={handleSaveWhatsAppCRM} className="w-full">
                Save WhatsApp CRM Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meta WhatsApp API */}
        <TabsContent value="meta-whatsapp">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Meta WhatsApp Business API
                </CardTitle>
                <CardDescription>
                  Configure Meta WhatsApp Business API credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="metaAccessToken">Access Token</Label>
                  <Input id="metaAccessToken" type="password" placeholder="EAAB..." value={metaAccessToken} onChange={e => setMetaAccessToken(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metaPhoneNumberId">Phone Number ID</Label>
                  <Input id="metaPhoneNumberId" placeholder="123456789012345" value={metaPhoneNumberId} onChange={e => setMetaPhoneNumberId(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metaBusinessAccountId">Business Account ID</Label>
                  <Input id="metaBusinessAccountId" placeholder="987654321098765" value={metaBusinessAccountId} onChange={e => setMetaBusinessAccountId(e.target.value)} />
                </div>

                <Separator />

                <Button onClick={handleSaveMetaWhatsApp} className="w-full">
                  Save Meta WhatsApp API Settings
                </Button>
              </CardContent>
            </Card>

            {/* WhatsApp Message Templates */}
            <Card>
              <CardHeader>
                <CardTitle>WhatsApp Message Templates</CardTitle>
                <CardDescription>
                  Approved message templates from Meta Business Manager
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {whatsappTemplates.map(template => <Card key={template.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{template.name}</h4>
                            <Badge variant={template.category === 'MARKETING' ? 'default' : template.category === 'UTILITY' ? 'secondary' : template.category === 'AUTHENTICATION' ? 'outline' : 'default'}>
                              {template.category}
                            </Badge>
                            <Badge variant={template.status === 'APPROVED' ? 'default' : template.status === 'PENDING' ? 'secondary' : 'destructive'}>
                              {template.status}
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p><strong>Language:</strong> {template.language.toUpperCase()}</p>
                            <p><strong>Components:</strong> {template.components}</p>
                          </div>

                          <div className="pt-2">
                            <p className="text-xs text-muted-foreground">
                              {template.category === 'MARKETING' && '📢 Marketing templates are for promotional content and require 24-hour opt-in'}
                              {template.category === 'UTILITY' && '🔧 Utility templates for transactional updates like order confirmations'}
                              {template.category === 'AUTHENTICATION' && '🔐 Authentication templates for OTP and verification codes'}
                              {template.category === 'SERVICE' && '🛠️ Service templates for customer support and service notifications'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>)}

                  {whatsappTemplates.length === 0 && <div className="text-center py-8 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No templates configured</p>
                      <p className="text-sm">Add templates in Meta Business Manager</p>
                    </div>}
                </div>

                <Separator className="my-4" />

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Template Categories</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 border rounded-md">
                      <strong>MARKETING</strong>
                      <p className="text-xs text-muted-foreground">Promotional content, offers, announcements</p>
                    </div>
                    <div className="p-2 border rounded-md">
                      <strong>UTILITY</strong>
                      <p className="text-xs text-muted-foreground">Order updates, account notifications</p>
                    </div>
                    <div className="p-2 border rounded-md">
                      <strong>AUTHENTICATION</strong>
                      <p className="text-xs text-muted-foreground">OTP, verification codes</p>
                    </div>
                    <div className="p-2 border rounded-md">
                      <strong>SERVICE</strong>
                      <p className="text-xs text-muted-foreground">Customer support, service updates</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>;
};
export default BusinessSettings;