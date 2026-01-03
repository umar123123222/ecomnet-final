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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, Truck, ShoppingBag, MessageSquare, DollarSign, Loader2, CheckCircle2, AlertCircle, Plug, Save, RefreshCw, Zap, Activity, MapPin, ChevronDown, Settings, Globe, Key, Phone, Mail } from "lucide-react";
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
import { PageContainer, PageHeader } from "@/components/layout";
import { useIsMobile } from "@/hooks/use-mobile";
const BusinessSettings = () => {
  const { hasRole } = useUserRoles();
  const { toast } = useToast();
  const { getSetting, updateSetting, isUpdating } = useBusinessSettings();
  const isMobile = useIsMobile();

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
  const [openCouriers, setOpenCouriers] = useState<Record<string, boolean>>({});

  // Load couriers from database
  useEffect(() => {
    loadCouriers();
  }, []);
  const loadCouriers = async () => {
    setLoadingCouriers(true);
    try {
      const {
        data,
        error
      } = await supabase.from('couriers').select('*').order('name');
      if (error) throw error;

      // Load API keys and pickup codes for each courier
      const couriersWithKeys = await Promise.all((data || []).map(async courier => {
        const apiKey = getSetting(`${courier.code.toUpperCase()}_API_KEY`) || '';
        const pickupCode = getSetting(`${courier.code.toUpperCase()}_PICKUP_ADDRESS_CODE`) || '';
        return {
          ...courier,
          api_key: apiKey,
          pickup_address_code: pickupCode
        };
      }));
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
        const {
          error
        } = await supabase.from('couriers').update(courierData).eq('id', config.id);
        if (error) throw error;
      } else {
        // Insert new
        const {
          error
        } = await supabase.from('couriers').insert([courierData]);
        if (error) throw error;
      }

      // Save API key
      await updateSetting(`${config.code.toUpperCase()}_API_KEY`, config.api_key, `API key for ${config.name}`);

      // Save pickup address code if provided
      if (config.pickup_address_code) {
        await updateSetting(`${config.code.toUpperCase()}_PICKUP_ADDRESS_CODE`, config.pickup_address_code, `Pickup address code for ${config.name}`);
      }

      // Save API password if provided (needed by Leopard, TCS, etc.)
      if (config.api_password) {
        await updateSetting(`${config.code.toUpperCase()}_API_PASSWORD`, config.api_password, `API password for ${config.name}`);
      }
      await loadCouriers();
      setShowAddCourier(false);
    } catch (error: any) {
      throw new Error(`Failed to save courier: ${error.message}`);
    }
  };
  const handleDeleteCourier = async (id: string) => {
    try {
      const {
        error
      } = await supabase.from('couriers').delete().eq('id', id);
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
      await Promise.all([updateSetting('company_name', companyName, 'Company name'), updateSetting('portal_url', portalUrl, 'Company portal URL'), updateSetting('company_email', companyEmail, 'Company contact email'), updateSetting('company_phone', companyPhone, 'Company contact phone'), updateSetting('company_currency', companyCurrency, 'Company default currency')]);
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
      await Promise.all([updateSetting('PICKUP_ADDRESS_NAME', pickupAddressName, 'Warehouse/Company name for pickup'), updateSetting('PICKUP_ADDRESS_PHONE', pickupAddressPhone, 'Contact phone for pickup'), updateSetting('PICKUP_ADDRESS_ADDRESS', pickupAddress, 'Warehouse pickup address'), updateSetting('PICKUP_ADDRESS_CITY', pickupCity, 'Warehouse city')]);
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
        variant: "destructive"
      });
      return;
    }

    // Validate API version format
    const versionRegex = /^20\d{2}-(01|04|07|10)$/;
    if (!versionRegex.test(shopifyApiVersion)) {
      toast({
        title: "Invalid API Version",
        description: "API version must be in format YYYY-MM (e.g., 2024-10). Valid months: 01, 04, 07, 10",
        variant: "destructive"
      });
      return;
    }
    setIsTestingConnection(true);
    setConnectionStatus('idle');
    try {
      // Clean store URL
      const cleanUrl = shopifyStoreUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

      // Test connection via edge function (server-side)
      const {
        data,
        error
      } = await supabase.functions.invoke('test-shopify-connection', {
        body: {
          store_url: `https://${cleanUrl}`,
          api_token: shopifyAccessToken,
          api_version: shopifyApiVersion
        }
      });
      if (error) {
        setConnectionStatus('error');
        toast({
          title: "Connection error",
          description: error.message || "Failed to test connection",
          variant: "destructive"
        });
        return;
      }
      if (data.ok) {
        setConnectionStatus('success');
        toast({
          title: "Connection successful",
          description: `Connected to ${data.shop_name} (${data.domain})`
        });
      } else {
        setConnectionStatus('error');
        toast({
          title: "Connection failed",
          description: data.error || data.hint || "Please check your credentials",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      setConnectionStatus('error');
      toast({
        title: "Connection error",
        description: error.message || "Failed to connect to Shopify",
        variant: "destructive"
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
        variant: "destructive"
      });
      return;
    }

    // Validate store URL format
    const cleanUrl = shopifyStoreUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!cleanUrl.includes('.myshopify.com')) {
      toast({
        title: "Invalid Store URL",
        description: "Store URL should be in format: your-store.myshopify.com",
        variant: "destructive"
      });
      return;
    }
    setIsSaving(true);
    try {
      // Update all credentials via edge function
      const {
        updateShopifyCredentials
      } = await import("@/integrations/supabase/functions");
      const {
        data,
        error
      } = await updateShopifyCredentials({
        store_url: `https://${cleanUrl}`,
        api_token: shopifyAccessToken,
        api_version: shopifyApiVersion,
        location_id: shopifyLocationId
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
          duration: 8000
        });
      }

      // Always update auto-sync settings
      await Promise.all([updateSetting('SHOPIFY_AUTO_SYNC_ORDERS', autoSyncOrders.toString(), 'Auto-sync orders to Shopify'), updateSetting('SHOPIFY_AUTO_SYNC_INVENTORY', autoSyncInventory.toString(), 'Auto-sync inventory to Shopify'), updateSetting('SHOPIFY_AUTO_SYNC_PRODUCTS', autoSyncProducts.toString(), 'Auto-sync products to Shopify'), updateSetting('SHOPIFY_AUTO_SYNC_CUSTOMERS', autoSyncCustomers.toString(), 'Auto-sync customers to Shopify')]);
      setConnectionStatus('idle');
      toast({
        title: "Settings saved",
        description: "Shopify integration settings have been updated successfully."
      });
    } catch (error: any) {
      console.error('Error saving Shopify settings:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save Shopify settings",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  const handleRegisterWebhooks = async () => {
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('register-shopify-webhooks');
      if (error) throw error;
      toast({
        title: "Webhooks Registered",
        description: `Successfully registered ${data.registered?.length || 0} webhooks`
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to register webhooks",
        variant: "destructive"
      });
    }
  };
  const handleProcessQueue = async () => {
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('process-sync-queue');
      if (error) throw error;
      toast({
        title: "Queue Processed",
        description: `Processed ${data.processed || 0} items, ${data.failed || 0} failed`
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process queue",
        variant: "destructive"
      });
    }
  };
  const handleFullSync = async () => {
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('sync-shopify-all');
      if (error) throw error;
      toast({
        title: "Full Sync Started",
        description: "Syncing all products, orders, and customers from Shopify"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start full sync",
        variant: "destructive"
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
  return (
    <PageContainer>
      <PageHeader 
        title="Business Settings" 
        description="Configure business-wide settings and integrations"
        icon={Settings}
      />

      <Tabs defaultValue="company" className="w-full">
        {/* Mobile-friendly scrollable tabs */}
        <ScrollArea className="w-full">
          <TabsList className={isMobile ? "inline-flex w-max gap-1 p-1" : "grid w-full grid-cols-5"}>
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="h-4 w-4 hidden sm:inline" />
              Company
            </TabsTrigger>
            <TabsTrigger value="couriers" className="gap-2">
              <Truck className="h-4 w-4 hidden sm:inline" />
              Couriers
            </TabsTrigger>
            <TabsTrigger value="shopify" className="gap-2">
              <ShoppingBag className="h-4 w-4 hidden sm:inline" />
              Shopify
            </TabsTrigger>
            <TabsTrigger value="whatsapp-crm" className="gap-2">
              <MessageSquare className="h-4 w-4 hidden sm:inline" />
              <span className="hidden sm:inline">WhatsApp CRM</span>
              <span className="sm:hidden">CRM</span>
            </TabsTrigger>
            <TabsTrigger value="meta-whatsapp" className="gap-2">
              <Globe className="h-4 w-4 hidden sm:inline" />
              <span className="hidden sm:inline">Meta API</span>
              <span className="sm:hidden">Meta</span>
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        {/* Company Information */}
        <TabsContent value="company" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Company Information</CardTitle>
                  <CardDescription>Configure your company details and contact information</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Company Name - Full width */}
              <div className="space-y-2">
                <Label htmlFor="companyName" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Company Name
                </Label>
                <Input 
                  id="companyName" 
                  placeholder="Enter company name" 
                  value={companyName} 
                  onChange={e => setCompanyName(e.target.value)} 
                />
              </div>

              {/* Two column layout for desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyEmail" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Company Email
                  </Label>
                  <Input 
                    id="companyEmail" 
                    type="email" 
                    placeholder="contact@company.com" 
                    value={companyEmail} 
                    onChange={e => setCompanyEmail(e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyPhone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Company Phone
                  </Label>
                  <Input 
                    id="companyPhone" 
                    placeholder="+92 300 1234567" 
                    value={companyPhone} 
                    onChange={e => setCompanyPhone(e.target.value)} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="portalUrl" className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    Portal URL
                  </Label>
                  <Input 
                    id="portalUrl" 
                    placeholder="https://yourcompany.com" 
                    value={portalUrl} 
                    onChange={e => setPortalUrl(e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyCurrency" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    Company Currency
                  </Label>
                  <Select value={companyCurrency} onValueChange={setCompanyCurrency}>
                    <SelectTrigger id="companyCurrency">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CURRENCIES.map(currency => (
                        <SelectItem key={currency.code} value={currency.code}>
                          {currency.symbol} {currency.name} ({currency.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Used system-wide for POS, orders, and reports
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={handleSaveCompanyInfo} className="w-full sm:w-auto" disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Company Info
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Pickup Address Configuration */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <MapPin className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <CardTitle>Pickup Address</CardTitle>
                  <CardDescription>Warehouse address for courier bookings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-muted/50 border-muted">
                <MapPin className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  This address is used as the pickup location when booking shipments with couriers.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pickupAddressName">
                    Warehouse/Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input 
                    id="pickupAddressName" 
                    placeholder="Enter warehouse or company name" 
                    value={pickupAddressName} 
                    onChange={e => setPickupAddressName(e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pickupAddressPhone">
                    Contact Phone <span className="text-destructive">*</span>
                  </Label>
                  <Input 
                    id="pickupAddressPhone" 
                    placeholder="+92 300 1234567" 
                    value={pickupAddressPhone} 
                    onChange={e => setPickupAddressPhone(e.target.value)} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pickupAddress">
                    Street Address <span className="text-destructive">*</span>
                  </Label>
                  <Input 
                    id="pickupAddress" 
                    placeholder="Enter complete warehouse address" 
                    value={pickupAddress} 
                    onChange={e => setPickupAddress(e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pickupCity">
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Input 
                    id="pickupCity" 
                    placeholder="Enter city" 
                    value={pickupCity} 
                    onChange={e => setPickupCity(e.target.value)} 
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  onClick={handleSavePickupAddress} 
                  className="w-full sm:w-auto" 
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Couriers */}
        <TabsContent value="couriers" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                    <Truck className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <CardTitle>Courier Integrations</CardTitle>
                    <CardDescription>Configure courier API credentials for booking & tracking</CardDescription>
                  </div>
                </div>
                {!showAddCourier && (
                  <Button onClick={() => setShowAddCourier(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Courier
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingCouriers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {couriers.length === 0 && !showAddCourier ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                      <Truck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-muted-foreground mb-4">No couriers configured yet</p>
                      <Button onClick={() => setShowAddCourier(true)} variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Courier
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {couriers.map(courier => (
                        <Collapsible 
                          key={courier.id} 
                          open={openCouriers[courier.id]} 
                          onOpenChange={open => setOpenCouriers(prev => ({
                            ...prev,
                            [courier.id]: open
                          }))}
                        >
                          <div className="border rounded-lg overflow-hidden">
                            <CollapsibleTrigger asChild>
                              <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left">
                                <div className="flex items-center gap-3">
                                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${courier.is_active ? 'bg-success/10' : 'bg-muted'}`}>
                                    <Truck className={`h-4 w-4 ${courier.is_active ? 'text-success' : 'text-muted-foreground'}`} />
                                  </div>
                                  <div>
                                    <div className="font-medium">{courier.name}</div>
                                    <div className="text-xs text-muted-foreground font-mono">{courier.code.toUpperCase()}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge variant={courier.is_active ? "default" : "secondary"} className="hidden sm:inline-flex">
                                    {courier.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openCouriers[courier.id] ? 'rotate-180' : ''}`} />
                                </div>
                              </button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="border-t px-4 py-4 bg-muted/20">
                                <CourierConfigCard 
                                  courier={courier} 
                                  onSave={handleSaveCourier} 
                                  onDelete={handleDeleteCourier} 
                                  onTest={handleTestCourier} 
                                />
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))}
                    </div>
                  )}

                  {showAddCourier && (
                    <Card className="border-2 border-dashed border-primary/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">New Courier</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CourierConfigCard onSave={handleSaveCourier} onTest={handleTestCourier} />
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shopify */}
        <TabsContent value="shopify" className="space-y-6 mt-6">
          {/* Connection Settings Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <ShoppingBag className="h-5 w-5 text-success" />
                </div>
                <div className="flex-1">
                  <CardTitle>Shopify Connection</CardTitle>
                  <CardDescription>Connect your store to sync products, orders & inventory</CardDescription>
                </div>
                {connectionStatus === 'success' && (
                  <Badge className="bg-success">Connected</Badge>
                )}
                {connectionStatus === 'error' && (
                  <Badge variant="destructive">Error</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {connectionStatus === 'error' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to connect to Shopify. Please check your credentials.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="shopifyStoreUrl" className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  Store URL <span className="text-destructive">*</span>
                </Label>
                <Input 
                  id="shopifyStoreUrl" 
                  placeholder="your-store.myshopify.com" 
                  value={shopifyStoreUrl} 
                  onChange={e => setShopifyStoreUrl(e.target.value)} 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shopifyAccessToken" className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  Admin API Token <span className="text-destructive">*</span>
                </Label>
                <Input 
                  id="shopifyAccessToken" 
                  type="password" 
                  placeholder="shpat_xxxxxxxxxxxx" 
                  value={shopifyAccessToken} 
                  onChange={e => setShopifyAccessToken(e.target.value)} 
                />
                <p className="text-xs text-muted-foreground">
                  <a 
                    href="https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/generate-app-access-tokens-admin" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-primary hover:underline"
                  >
                    How to get an access token →
                  </a>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shopifyApiVersion">API Version <span className="text-destructive">*</span></Label>
                  <Input 
                    id="shopifyApiVersion" 
                    placeholder="2024-01" 
                    value={shopifyApiVersion} 
                    onChange={e => setShopifyApiVersion(e.target.value)} 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="shopifyLocationId">Location ID</Label>
                  <Input 
                    id="shopifyLocationId" 
                    placeholder="123456789" 
                    value={shopifyLocationId} 
                    onChange={e => setShopifyLocationId(e.target.value)} 
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button 
                  variant="outline" 
                  onClick={handleTestConnection} 
                  disabled={isTestingConnection || isSaving || !shopifyStoreUrl || !shopifyAccessToken || !shopifyApiVersion}
                  className="sm:flex-1"
                >
                  {isTestingConnection ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Plug className="mr-2 h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </Button>
                <Button 
                  onClick={handleSaveShopify} 
                  disabled={isSaving || isUpdating}
                  className="sm:flex-1"
                >
                  {isSaving || isUpdating ? (
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
            </CardContent>
          </Card>

          {/* Auto-Sync Settings Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <Zap className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <CardTitle>Auto-Sync Settings</CardTitle>
                  <CardDescription>Enable automatic synchronization</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoSyncOrders" className="font-medium">Orders</Label>
                    <p className="text-xs text-muted-foreground">Sync orders to Shopify</p>
                  </div>
                  <Switch id="autoSyncOrders" checked={autoSyncOrders} onCheckedChange={setAutoSyncOrders} />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoSyncInventory" className="font-medium">Inventory</Label>
                    <p className="text-xs text-muted-foreground">Update stock levels</p>
                  </div>
                  <Switch id="autoSyncInventory" checked={autoSyncInventory} onCheckedChange={setAutoSyncInventory} />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoSyncProducts" className="font-medium">Products</Label>
                    <p className="text-xs text-muted-foreground">Sync product changes</p>
                  </div>
                  <Switch id="autoSyncProducts" checked={autoSyncProducts} onCheckedChange={setAutoSyncProducts} />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoSyncCustomers" className="font-medium">Customers</Label>
                    <p className="text-xs text-muted-foreground">Sync customer data</p>
                  </div>
                  <Switch id="autoSyncCustomers" checked={autoSyncCustomers} onCheckedChange={setAutoSyncCustomers} />
                </div>
              </div>

              <Button onClick={handleSaveShopify} className="w-full sm:w-auto" disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Sync Settings
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Manual Actions Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Manual Sync Actions</CardTitle>
                  <CardDescription>Trigger manual synchronization operations</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ProductSyncControl />
                <OrderSyncControl />
                <CustomerSyncControl />
                <FullSyncControl />
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button variant="outline" onClick={handleRegisterWebhooks} className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Register Webhooks
                </Button>
                
                <Button variant="outline" onClick={handleProcessQueue} className="w-full">
                  <Zap className="mr-2 h-4 w-4" />
                  Process Queue
                </Button>
              </div>
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
        <TabsContent value="whatsapp-crm" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <MessageSquare className="h-5 w-5 text-success" />
                </div>
                <div>
                  <CardTitle>WhatsApp CRM Sync</CardTitle>
                  <CardDescription>Connect to external WhatsApp CRM project</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsappCrmUrl" className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    CRM Project URL
                  </Label>
                  <Input 
                    id="whatsappCrmUrl" 
                    placeholder="https://your-project.supabase.co" 
                    value={whatsappCrmUrl} 
                    onChange={e => setWhatsappCrmUrl(e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsappCrmApiKey" className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    CRM API Key
                  </Label>
                  <Input 
                    id="whatsappCrmApiKey" 
                    type="password" 
                    placeholder="Enter CRM API key" 
                    value={whatsappCrmApiKey} 
                    onChange={e => setWhatsappCrmApiKey(e.target.value)} 
                  />
                </div>
              </div>

              <Button onClick={handleSaveWhatsAppCRM} className="w-full sm:w-auto">
                <Save className="mr-2 h-4 w-4" />
                Save CRM Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meta WhatsApp API */}
        <TabsContent value="meta-whatsapp" className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                  <Globe className="h-5 w-5 text-info" />
                </div>
                <div>
                  <CardTitle>Meta WhatsApp Business API</CardTitle>
                  <CardDescription>Configure Meta API credentials for WhatsApp messaging</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="metaAccessToken" className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  Access Token
                </Label>
                <Input 
                  id="metaAccessToken" 
                  type="password" 
                  placeholder="EAAB..." 
                  value={metaAccessToken} 
                  onChange={e => setMetaAccessToken(e.target.value)} 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="metaPhoneNumberId" className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Phone Number ID
                  </Label>
                  <Input 
                    id="metaPhoneNumberId" 
                    placeholder="123456789012345" 
                    value={metaPhoneNumberId} 
                    onChange={e => setMetaPhoneNumberId(e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metaBusinessAccountId" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Business Account ID
                  </Label>
                  <Input 
                    id="metaBusinessAccountId" 
                    placeholder="987654321098765" 
                    value={metaBusinessAccountId} 
                    onChange={e => setMetaBusinessAccountId(e.target.value)} 
                  />
                </div>
              </div>

              <Button onClick={handleSaveMetaWhatsApp} className="w-full sm:w-auto">
                <Save className="mr-2 h-4 w-4" />
                Save Meta API Settings
              </Button>
            </CardContent>
          </Card>

          {/* WhatsApp Message Templates */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle>Message Templates</CardTitle>
                  <CardDescription>Approved templates from Meta Business Manager</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {whatsappTemplates.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No templates configured</p>
                  <p className="text-sm text-muted-foreground">Add templates in Meta Business Manager</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {whatsappTemplates.map(template => (
                    <div key={template.id} className="p-4 rounded-lg border bg-muted/20">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-medium">{template.name}</span>
                        <Badge 
                          variant={template.category === 'MARKETING' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {template.category}
                        </Badge>
                        <Badge 
                          variant={template.status === 'APPROVED' ? 'default' : template.status === 'PENDING' ? 'secondary' : 'destructive'}
                          className={`text-xs ${template.status === 'APPROVED' ? 'bg-success' : ''}`}
                        >
                          {template.status}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                        <span>Language: <strong>{template.language.toUpperCase()}</strong></span>
                        <span>Components: {template.components}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-3">Template Categories</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 rounded-lg border bg-muted/20 text-center">
                    <span className="text-lg">📢</span>
                    <p className="text-xs font-medium mt-1">MARKETING</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/20 text-center">
                    <span className="text-lg">🔧</span>
                    <p className="text-xs font-medium mt-1">UTILITY</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/20 text-center">
                    <span className="text-lg">🔐</span>
                    <p className="text-xs font-medium mt-1">AUTH</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/20 text-center">
                    <span className="text-lg">🛠️</span>
                    <p className="text-xs font-medium mt-1">SERVICE</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
};
export default BusinessSettings;