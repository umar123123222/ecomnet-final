import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Navigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Building2, Link, Mail, Phone, Truck, ShoppingBag, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const BusinessSettings = () => {
  const { hasAnyRole } = useUserRoles();
  const { toast } = useToast();
  
  // Only super_admin and super_manager can access
  if (!hasAnyRole(['super_admin', 'super_manager'])) {
    return <Navigate to="/" replace />;
  }

  // Company Info State
  const [companyName, setCompanyName] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');

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

  const handleSaveCompanyInfo = () => {
    toast({
      title: "Company Information Saved",
      description: "Your company details have been updated successfully.",
    });
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
    setCouriers(couriers.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const handleSaveCouriers = () => {
    toast({
      title: "Couriers Saved",
      description: "Courier configurations have been updated.",
    });
  };

  const handleSaveShopify = () => {
    toast({
      title: "Shopify Settings Saved",
      description: "Shopify integration has been configured.",
    });
  };

  const handleSaveWhatsAppCRM = () => {
    toast({
      title: "WhatsApp CRM Saved",
      description: "WhatsApp CRM sync has been configured.",
    });
  };

  const handleSaveMetaWhatsApp = () => {
    toast({
      title: "Meta WhatsApp API Saved",
      description: "Meta WhatsApp API has been configured.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Business Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure business-wide settings and integrations
        </p>
      </div>

      <Tabs defaultValue="company" className="w-full">
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
                <Input
                  id="companyName"
                  placeholder="Enter company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="portalUrl">Portal URL</Label>
                <div className="flex gap-2">
                  <Link className="h-9 w-9 flex items-center justify-center border rounded-md" />
                  <Input
                    id="portalUrl"
                    placeholder="https://yourcompany.com"
                    value={portalUrl}
                    onChange={(e) => setPortalUrl(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyEmail">Company Email</Label>
                <div className="flex gap-2">
                  <Mail className="h-9 w-9 flex items-center justify-center border rounded-md" />
                  <Input
                    id="companyEmail"
                    type="email"
                    placeholder="contact@company.com"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyPhone">Company Phone Number</Label>
                <div className="flex gap-2">
                  <Phone className="h-9 w-9 flex items-center justify-center border rounded-md" />
                  <Input
                    id="companyPhone"
                    placeholder="+92 300 1234567"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <Separator />

              <Button onClick={handleSaveCompanyInfo} className="w-full">
                Save Company Information
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
              {couriers.map((courier) => (
                <Card key={courier.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Courier Configuration</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCourier(courier.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Courier Name</Label>
                        <Input
                          placeholder="TCS, Leopards, etc."
                          value={courier.name}
                          onChange={(e) => handleUpdateCourier(courier.id, 'name', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Courier Code</Label>
                        <Input
                          placeholder="tcs, leopards, etc."
                          value={courier.code}
                          onChange={(e) => handleUpdateCourier(courier.id, 'code', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>API Endpoint</Label>
                      <Input
                        placeholder="https://api.courier.com/v1"
                        value={courier.apiEndpoint}
                        onChange={(e) => handleUpdateCourier(courier.id, 'apiEndpoint', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input
                        type="password"
                        placeholder="Enter API key"
                        value={courier.apiKey}
                        onChange={(e) => handleUpdateCourier(courier.id, 'apiKey', e.target.value)}
                      />
                    </div>
                  </div>
                </Card>
              ))}

              <Button
                variant="outline"
                onClick={handleAddCourier}
                className="w-full"
              >
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
                <Input
                  id="shopifyStoreUrl"
                  placeholder="yourstore.myshopify.com"
                  value={shopifyStoreUrl}
                  onChange={(e) => setShopifyStoreUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shopifyAccessToken">Admin API Access Token</Label>
                <Input
                  id="shopifyAccessToken"
                  type="password"
                  placeholder="shpat_xxxxxxxxxxxx"
                  value={shopifyAccessToken}
                  onChange={(e) => setShopifyAccessToken(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shopifyApiVersion">API Version</Label>
                <Input
                  id="shopifyApiVersion"
                  placeholder="2024-01"
                  value={shopifyApiVersion}
                  onChange={(e) => setShopifyApiVersion(e.target.value)}
                />
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
                <Input
                  id="whatsappCrmUrl"
                  placeholder="https://your-project.supabase.co"
                  value={whatsappCrmUrl}
                  onChange={(e) => setWhatsappCrmUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsappCrmApiKey">CRM API Key</Label>
                <Input
                  id="whatsappCrmApiKey"
                  type="password"
                  placeholder="Enter CRM API key"
                  value={whatsappCrmApiKey}
                  onChange={(e) => setWhatsappCrmApiKey(e.target.value)}
                />
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
                <Input
                  id="metaAccessToken"
                  type="password"
                  placeholder="EAAB..."
                  value={metaAccessToken}
                  onChange={(e) => setMetaAccessToken(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="metaPhoneNumberId">Phone Number ID</Label>
                <Input
                  id="metaPhoneNumberId"
                  placeholder="123456789012345"
                  value={metaPhoneNumberId}
                  onChange={(e) => setMetaPhoneNumberId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="metaBusinessAccountId">Business Account ID</Label>
                <Input
                  id="metaBusinessAccountId"
                  placeholder="987654321098765"
                  value={metaBusinessAccountId}
                  onChange={(e) => setMetaBusinessAccountId(e.target.value)}
                />
              </div>

              <Separator />

              <Button onClick={handleSaveMetaWhatsApp} className="w-full">
                Save Meta WhatsApp API Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BusinessSettings;
