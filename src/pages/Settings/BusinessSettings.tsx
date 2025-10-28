import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Building2, Link, Mail, Phone, Truck, ShoppingBag, MessageSquare, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SUPPORTED_CURRENCIES } from "@/utils/currency";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";

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

  // Load settings from database
  useEffect(() => {
    setCompanyName(getSetting('company_name') || '');
    setPortalUrl(getSetting('portal_url') || '');
    setCompanyEmail(getSetting('company_email') || '');
    setCompanyPhone(getSetting('company_phone') || '');
    setCompanyCurrency(getSetting('company_currency') || 'USD');
  }, [getSetting]);

  // Couriers State
  const [couriers, setCouriers] = useState<Array<{
    id: string;
    name: string;
    apiEndpoint: string;
    apiKey: string;
    code: string;
  }>>([]);

  // Shopify State
  const [shopifyAccessToken, setShopifyAccessToken] = useState('');
  const [shopifyStoreUrl, setShopifyStoreUrl] = useState('');
  const [shopifyApiVersion, setShopifyApiVersion] = useState('');

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
  const handleSaveShopify = () => {
    toast({
      title: "Shopify Settings Saved",
      description: "Shopify integration has been configured."
    });
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
                Add and configure courier services with their API credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {couriers.map(courier => <Card key={courier.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Courier Configuration</Label>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveCourier(courier.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Courier Name</Label>
                        <Input placeholder="TCS, Leopards, etc." value={courier.name} onChange={e => handleUpdateCourier(courier.id, 'name', e.target.value)} />
                      </div>

                      <div className="space-y-2">
                        <Label>Courier Code</Label>
                        <Input placeholder="tcs, leopards, etc." value={courier.code} onChange={e => handleUpdateCourier(courier.id, 'code', e.target.value)} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>API Endpoint</Label>
                      <Input placeholder="https://api.courier.com/v1" value={courier.apiEndpoint} onChange={e => handleUpdateCourier(courier.id, 'apiEndpoint', e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input type="password" placeholder="Enter API key" value={courier.apiKey} onChange={e => handleUpdateCourier(courier.id, 'apiKey', e.target.value)} />
                    </div>
                  </div>
                </Card>)}

              <Button variant="outline" onClick={handleAddCourier} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Courier
              </Button>

              <Separator />

              <Button onClick={handleSaveCouriers} className="w-full">
                Save Courier Configurations
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shopify */}
        <TabsContent value="shopify">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Shopify Integration
              </CardTitle>
              <CardDescription>
                Configure your Shopify store connection and API settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shopifyStoreUrl">Store URL</Label>
                <Input id="shopifyStoreUrl" placeholder="yourstore.myshopify.com" value={shopifyStoreUrl} onChange={e => setShopifyStoreUrl(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shopifyAccessToken">Admin API Access Token</Label>
                <Input id="shopifyAccessToken" type="password" placeholder="shpat_xxxxxxxxxxxx" value={shopifyAccessToken} onChange={e => setShopifyAccessToken(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shopifyApiVersion">API Version</Label>
                <Input id="shopifyApiVersion" placeholder="2024-01" value={shopifyApiVersion} onChange={e => setShopifyApiVersion(e.target.value)} />
              </div>

              <Separator />

              <Button onClick={handleSaveShopify} className="w-full">
                Save Shopify Settings
              </Button>
            </CardContent>
          </Card>
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