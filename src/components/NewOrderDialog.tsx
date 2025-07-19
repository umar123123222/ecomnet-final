import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface NewOrderDialogProps {
  onOrderCreated: () => void;
}

const NewOrderDialog = ({ onOrderCreated }: NewOrderDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const { toast } = useToast();

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [city, setCity] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: '', quantity: 1, price: 0 }
  ]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name');

      if (!error && data) {
        setUsers(data);
      }
    };

    if (open) {
      fetchUsers();
    }
  }, [open]);

  const handleAddProduct = () => {
    const newProduct: Product = {
      id: Date.now().toString(),
      name: '',
      quantity: 1,
      price: 0
    };
    setProducts([...products, newProduct]);
  };

  const handleRemoveProduct = (id: string) => {
    if (products.length > 1) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const handleProductChange = (id: string, field: keyof Product, value: string | number) => {
    setProducts(products.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const calculateTotal = () => {
    return products.reduce((total, product) => total + (product.quantity * product.price), 0);
  };

  const generateOrderNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setCustomerAddress('');
    setCity('');
    setCreatedBy('');
    setProducts([{ id: '1', name: '', quantity: 1, price: 0 }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName || !customerPhone || !customerAddress || !createdBy) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const validProducts = products.filter(p => p.name && p.quantity > 0 && p.price > 0);
    if (validProducts.length === 0) {
      toast({
        title: "Invalid Products",
        description: "Please add at least one valid product",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const orderNumber = generateOrderNumber();
      const totalAmount = calculateTotal();
      const phoneLastFiveChr = customerPhone.slice(-5);

      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          customer_address: customerAddress,
          city: city,
          total_amount: totalAmount,
          customer_phone_last_5_chr: phoneLastFiveChr,
          total_items: validProducts.length.toString(),
          status: 'pending',
          order_type: 'standard',
          items: validProducts.map(p => ({
            name: p.name,
            quantity: p.quantity,
            price: p.price
          }))
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      if (orderData) {
        const orderItems = validProducts.map(product => ({
          order_id: orderData.id,
          item_name: product.name,
          quantity: product.quantity,
          price: product.price
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Order Created",
        description: `Order ${orderNumber} has been created successfully`,
      });

      resetForm();
      setOpen(false);
      onOrderCreated();

    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: "Error",
        description: "Failed to create order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Order</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customerName">Customer Name *</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="customerPhone">Phone Number *</Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="customerAddress">Address *</Label>
              <Textarea
                id="customerAddress"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Order Details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Order Details</h3>
              <Button type="button" onClick={handleAddProduct} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>
            
            <div className="space-y-3">
              {products.map((product, index) => (
                <div key={product.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 border rounded-lg">
                  <div className="md:col-span-2">
                    <Label htmlFor={`product-name-${product.id}`}>Product Name</Label>
                    <Input
                      id={`product-name-${product.id}`}
                      value={product.name}
                      onChange={(e) => handleProductChange(product.id, 'name', e.target.value)}
                      placeholder="Enter product name"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`product-quantity-${product.id}`}>Quantity</Label>
                    <Input
                      id={`product-quantity-${product.id}`}
                      type="number"
                      min="1"
                      value={product.quantity}
                      onChange={(e) => handleProductChange(product.id, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`product-price-${product.id}`}>Price (PKR)</Label>
                    <Input
                      id={`product-price-${product.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={product.price}
                      onChange={(e) => handleProductChange(product.id, 'price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="flex items-end">
                    {products.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveProduct(product.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-right">
              <p className="text-lg font-semibold">
                Total: PKR {calculateTotal().toLocaleString()}
              </p>
            </div>
          </div>

          {/* Order Created By */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Order Information</h3>
            <div>
              <Label htmlFor="createdBy">Created By *</Label>
              <Select value={createdBy} onValueChange={setCreatedBy} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Order"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewOrderDialog;