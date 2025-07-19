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
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const { toast } = useToast();

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [city, setCity] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [orderNotes, setOrderNotes] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name');

      if (!usersError && usersData) {
        setUsers(usersData);
      }

      // Fetch products from database
      const { data: productsData, error: productsError } = await supabase
        .from('product')
        .select('id, name, price')
        .order('name');

      if (!productsError && productsData) {
        setAvailableProducts(productsData);
      } else {
        // Fallback to sample products if fetch fails
        setAvailableProducts([
          { id: 1, name: 'Sample Product 1', price: '1500' },
          { id: 2, name: 'Sample Product 2', price: '2500' },
          { id: 3, name: 'Sample Product 3', price: '3500' }
        ]);
      }
    };

    if (open) {
      fetchData();
    }
  }, [open]);

  const handleAddProduct = (productId: string) => {
    const product = availableProducts.find(p => p.id.toString() === productId);
    if (product && !selectedProducts.find(p => p.id === productId)) {
      const newProduct: Product = {
        id: productId,
        name: product.name,
        quantity: 1,
        price: parseFloat(product.price) || 0
      };
      setSelectedProducts([...selectedProducts, newProduct]);
    }
  };

  const handleRemoveProduct = (id: string) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== id));
  };

  const handleQuantityChange = (id: string, quantity: number) => {
    setSelectedProducts(selectedProducts.map(p => 
      p.id === id ? { ...p, quantity: quantity } : p
    ));
  };

  const calculateTotal = () => {
    return selectedProducts.reduce((total, product) => total + (product.quantity * product.price), 0);
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
    setSelectedProducts([]);
    setOrderNotes('');
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

    if (selectedProducts.length === 0) {
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
          total_items: selectedProducts.length.toString(),
          status: 'pending',
          order_type: 'standard',
          items: selectedProducts.map(p => ({
            name: p.name,
            quantity: p.quantity,
            price: p.price
          })),
          notes: orderNotes
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      if (orderData) {
        const orderItems = selectedProducts.map(product => ({
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
              <div className="flex gap-2">
                <Select onValueChange={handleAddProduct}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((product) => (
                      <SelectItem 
                        key={product.id} 
                        value={product.id.toString()}
                        disabled={selectedProducts.some(p => p.id === product.id.toString())}
                      >
                        {product.name} - PKR {product.price}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-3">
              {selectedProducts.map((product) => (
                <div key={product.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 border rounded-lg">
                  <div className="md:col-span-2">
                    <Label>Product Name</Label>
                    <Input value={product.name} readOnly />
                  </div>
                  <div>
                    <Label htmlFor={`product-quantity-${product.id}`}>Quantity</Label>
                    <Input
                      id={`product-quantity-${product.id}`}
                      type="number"
                      min="1"
                      value={product.quantity}
                      onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveProduct(product.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Label htmlFor="orderNotes">Order Notes</Label>
              <Textarea
                id="orderNotes"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="Add any special notes for this order..."
              />
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