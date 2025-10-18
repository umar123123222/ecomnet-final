import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { POSSession as POSSessionType, POSCartItem } from '@/types/pos';
import POSSession from '@/components/pos/POSSession';
import ProductSelector from '@/components/pos/ProductSelector';
import POSCart from '@/components/pos/POSCart';
import PaymentPanel from '@/components/pos/PaymentPanel';
import { Loader2, ShoppingCart } from 'lucide-react';

const POSMain = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeSession, setActiveSession] = useState<POSSessionType | null>(null);
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [showPayment, setShowPayment] = useState(false);

  // Fetch active session
  const { data: session, isLoading } = useQuery({
    queryKey: ['pos-session', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_sessions')
        .select('*')
        .eq('cashier_id', user?.id)
        .eq('status', 'open')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (session) {
      setActiveSession(session as POSSessionType);
    }
  }, [session]);

  const handleAddToCart = (product: any, quantity: number) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + quantity }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        quantity,
        unit_price: product.price,
        discount_percent: 0,
        available_quantity: product.available_quantity,
      }]);
    }
    toast.success(`${product.name} added to cart`);
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.product_id !== productId));
    } else {
      setCart(cart.map(item =>
        item.product_id === productId ? { ...item, quantity } : item
      ));
    }
  };

  const handleUpdateDiscount = (productId: string, discount: number) => {
    setCart(cart.map(item =>
      item.product_id === productId ? { ...item, discount_percent: discount } : item
    ));
  };

  const handleRemoveItem = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
    setShowPayment(false);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setShowPayment(true);
  };

  const handlePaymentComplete = () => {
    setCart([]);
    setShowPayment(false);
    queryClient.invalidateQueries({ queryKey: ['pos-sales'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="container mx-auto p-6">
        <POSSession onSessionOpened={setActiveSession} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Point of Sale</h1>
            <p className="text-sm text-muted-foreground">
              Session: {activeSession.session_number}
            </p>
          </div>
          <POSSession 
            currentSession={activeSession} 
            onSessionClosed={() => setActiveSession(null)} 
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-88px)]">
        {/* Product Selection - Left Side */}
        <div className="flex-1 overflow-auto p-6">
          <ProductSelector 
            outletId={activeSession.outlet_id}
            onAddToCart={handleAddToCart}
          />
        </div>

        {/* Cart & Payment - Right Side */}
        <div className="w-[450px] border-l bg-card flex flex-col">
          {showPayment ? (
            <PaymentPanel
              cart={cart}
              sessionId={activeSession.id}
              outletId={activeSession.outlet_id}
              onBack={() => setShowPayment(false)}
              onComplete={handlePaymentComplete}
            />
          ) : (
            <>
              <div className="p-4 border-b">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Cart ({cart.length})</h2>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                <POSCart
                  items={cart}
                  onUpdateQuantity={handleUpdateQuantity}
                  onUpdateDiscount={handleUpdateDiscount}
                  onRemoveItem={handleRemoveItem}
                />
              </div>

              <div className="p-4 border-t space-y-2">
                <Button 
                  onClick={handleCheckout}
                  disabled={cart.length === 0}
                  className="w-full"
                  size="lg"
                >
                  Checkout
                </Button>
                <Button 
                  onClick={handleClearCart}
                  variant="outline"
                  className="w-full"
                >
                  Clear Cart
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default POSMain;
