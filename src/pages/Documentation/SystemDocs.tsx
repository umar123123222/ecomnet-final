import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, Database, Workflow, ShoppingCart, Package, 
  TrendingUp, Users, Settings, FileText, Code 
} from "lucide-react";

export default function SystemDocs() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            System Documentation
          </CardTitle>
          <CardDescription>
            Complete guide to system features, architecture, and workflows
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="architecture">Architecture</TabsTrigger>
              <TabsTrigger value="workflows">Workflows</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="api">API Reference</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  <section>
                    <h2 className="text-2xl font-bold mb-4">System Overview</h2>
                    <p className="text-muted-foreground mb-4">
                      A comprehensive Warehouse Management System (WMS) with Shopify integration, 
                      multi-courier dispatch, inventory tracking, and advanced analytics.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="h-5 w-5" />
                            Inventory Management
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>• Real-time stock tracking across outlets</li>
                            <li>• Reserved inventory for orders</li>
                            <li>• Smart reorder automation</li>
                            <li>• ABC analysis & forecasting</li>
                            <li>• Barcode & batch tracking</li>
                          </ul>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5" />
                            Order Management
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>• Shopify order sync (bidirectional)</li>
                            <li>• Customer confirmations via WhatsApp</li>
                            <li>• Fraud detection & risk scoring</li>
                            <li>• Address verification</li>
                            <li>• Bulk operations support</li>
                          </ul>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Dispatch & Logistics
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>• Multi-courier integration</li>
                            <li>• Automated booking & tracking</li>
                            <li>• Rate comparison</li>
                            <li>• AWB generation</li>
                            <li>• Returns management</li>
                          </ul>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            User Management
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>• Role-based access control</li>
                            <li>• Multi-outlet staff assignment</li>
                            <li>• Activity logging & audit trail</li>
                            <li>• Supplier portal access</li>
                            <li>• POS session management</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xl font-semibold mb-3">Key Features</h3>
                    <div className="grid gap-3">
                      <Badge variant="outline" className="w-fit">✓ Real-time Shopify Sync</Badge>
                      <Badge variant="outline" className="w-fit">✓ Automated Smart Reordering</Badge>
                      <Badge variant="outline" className="w-fit">✓ Multi-Courier Integration</Badge>
                      <Badge variant="outline" className="w-fit">✓ WhatsApp Notifications</Badge>
                      <Badge variant="outline" className="w-fit">✓ Barcode Scanning</Badge>
                      <Badge variant="outline" className="w-fit">✓ Advanced Analytics</Badge>
                      <Badge variant="outline" className="w-fit">✓ Production Management</Badge>
                      <Badge variant="outline" className="w-fit">✓ Quality Control</Badge>
                    </div>
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="architecture" className="space-y-4">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  <section>
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                      <Database className="h-6 w-6" />
                      System Architecture
                    </h2>
                    
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle>Technology Stack</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-semibold mb-2">Frontend</h4>
                            <ul className="space-y-1 text-sm text-muted-foreground">
                              <li>• React 18 with TypeScript</li>
                              <li>• Vite for build tooling</li>
                              <li>• TanStack Query for data fetching</li>
                              <li>• Tailwind CSS for styling</li>
                              <li>• Shadcn UI components</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Backend</h4>
                            <ul className="space-y-1 text-sm text-muted-foreground">
                              <li>• Supabase (PostgreSQL)</li>
                              <li>• Edge Functions (Deno)</li>
                              <li>• Row Level Security (RLS)</li>
                              <li>• Real-time subscriptions</li>
                              <li>• Automated cron jobs</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <h3 className="text-xl font-semibold mb-3">Database Schema</h3>
                    <p className="text-muted-foreground mb-4">
                      The system uses a normalized relational database with 40+ tables organized into logical domains:
                    </p>
                    <div className="grid gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Core Tables</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <code>orders, customers, products, inventory, outlets, profiles</code>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Logistics Tables</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <code>dispatches, couriers, courier_booking_queue, courier_tracking_history</code>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Sync & Integration</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <code>sync_queue, sync_conflicts, api_settings, webhooks</code>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Automation & Alerts</CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                          <code>automated_alerts, low_stock_notifications, auto_purchase_orders</code>
                        </CardContent>
                      </Card>
                    </div>
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="workflows" className="space-y-4">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  <section>
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                      <Workflow className="h-6 w-6" />
                      Key Workflows
                    </h2>

                    <div className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Order Processing Workflow</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ol className="space-y-2 text-sm">
                            <li>1. Order created (Shopify webhook or manual entry)</li>
                            <li>2. Customer linked/created automatically</li>
                            <li>3. Fraud risk assessment runs</li>
                            <li>4. Inventory reserved for order</li>
                            <li>5. Confirmation sent to customer (if required)</li>
                            <li>6. Customer confirms/cancels</li>
                            <li>7. Order booked with courier</li>
                            <li>8. Dispatch created, tracking updates</li>
                            <li>9. Status synced back to Shopify</li>
                            <li>10. Delivery/return processed</li>
                          </ol>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Smart Reorder Workflow</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ol className="space-y-2 text-sm">
                            <li>1. Scheduled job checks inventory levels</li>
                            <li>2. Calculates consumption rates and forecasts</li>
                            <li>3. Identifies products below reorder point</li>
                            <li>4. Calculates optimal order quantity</li>
                            <li>5. Notifies supplier via WhatsApp/email</li>
                            <li>6. Creates draft purchase order</li>
                            <li>7. Auto-approves if configured</li>
                            <li>8. Tracks supplier response</li>
                          </ol>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Shopify Sync Workflow</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ol className="space-y-2 text-sm">
                            <li>1. Changes detected via webhooks or polling</li>
                            <li>2. Queued in sync_queue with priority</li>
                            <li>3. Batch processor runs every minute</li>
                            <li>4. Updates pushed to Shopify API</li>
                            <li>5. Conflicts detected and logged</li>
                            <li>6. Failed syncs retried with backoff</li>
                            <li>7. Status tracked in sync_queue</li>
                          </ol>
                        </CardContent>
                      </Card>
                    </div>
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="features" className="space-y-4">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold mb-4">Feature Documentation</h2>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Advanced Filtering & Bulk Operations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p>• Filter orders by status, date, courier, outlet, tags</p>
                      <p>• Bulk status updates with validation</p>
                      <p>• Bulk courier booking with rate comparison</p>
                      <p>• Export filtered data to CSV/Excel</p>
                      <p>• Saved filter presets for quick access</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Automated Alerts System</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p>• Stuck order detection (&gt;7 days pending)</p>
                      <p>• Overdue return tracking</p>
                      <p>• Low stock warnings</p>
                      <p>• Sync failure alerts</p>
                      <p>• Critical issue notifications</p>
                      <p>• Severity-based prioritization</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Activity Logging</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p>• Comprehensive audit trail</p>
                      <p>• User action tracking</p>
                      <p>• Entity change history</p>
                      <p>• Searchable and filterable logs</p>
                      <p>• Export capabilities</p>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="api" className="space-y-4">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  <section>
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                      <Code className="h-6 w-6" />
                      Edge Functions Reference
                    </h2>
                    
                    <p className="text-muted-foreground mb-6">
                      The system includes 40+ edge functions for backend logic:
                    </p>

                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="font-mono text-sm">sync-shopify-products</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <p className="text-muted-foreground">Syncs products from Shopify to local database</p>
                          <code className="block bg-muted p-2 rounded">
                            POST /functions/v1/sync-shopify-products
                          </code>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="font-mono text-sm">courier-booking</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <p className="text-muted-foreground">Books courier for order dispatch</p>
                          <code className="block bg-muted p-2 rounded">
                            POST /functions/v1/courier-booking
                          </code>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="font-mono text-sm">scheduled-smart-reorder</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <p className="text-muted-foreground">Automated inventory reordering (runs daily)</p>
                          <code className="block bg-muted p-2 rounded">
                            POST /functions/v1/scheduled-smart-reorder
                          </code>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="font-mono text-sm">check-stuck-orders</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <p className="text-muted-foreground">Identifies and alerts on stuck orders</p>
                          <code className="block bg-muted p-2 rounded">
                            POST /functions/v1/check-stuck-orders
                          </code>
                        </CardContent>
                      </Card>
                    </div>

                    <p className="text-sm text-muted-foreground mt-6">
                      See <code>supabase/functions/</code> directory for complete function list
                    </p>
                  </section>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
