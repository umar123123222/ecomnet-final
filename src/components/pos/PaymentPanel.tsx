import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { POSCartItem } from '@/types/pos';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, CreditCard, Smartphone, Banknote, Printer } from 'lucide-react';

interface PaymentPanelProps {
  cart: POSCartItem[];
  sessionId: string;
  outletId: string;
  onBack: () => void;
  onComplete: () => void;
}

const PaymentPanel = ({ cart, sessionId, outletId, onBack, onComplete }: PaymentPanelProps) => {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile_wallet'>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const discount = (item.unit_price * item.quantity * item.discount_percent) / 100;
      return sum + (item.unit_price * item.quantity - discount);
    }, 0);
  };

  const total = calculateTotal();
  const change = parseFloat(amountPaid || '0') - total;

  const printReceipt = (sale: any, outlet: any) => {
    const receiptWindow = window.open('', '', 'width=300,height=600');
    if (!receiptWindow) return;

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${sale.sale_number}</title>
        <style>
          body { font-family: monospace; width: 300px; margin: 0; padding: 20px; }
          h1 { text-align: center; font-size: 18px; margin: 10px 0; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .item { display: flex; justify-content: space-between; margin: 5px 0; }
          .total { font-weight: bold; font-size: 16px; margin-top: 10px; }
          .center { text-align: center; }
          .small { font-size: 11px; }
        </style>
      </head>
      <body>
        <h1>${outlet?.name || 'POS Receipt'}</h1>
        <div class="center small">${outlet?.address || ''}</div>
        <div class="divider"></div>
        <div class="small">
          <div>Receipt: ${sale.sale_number}</div>
          <div>Date: ${new Date(sale.created_at).toLocaleString()}</div>
          <div>Cashier: ${sale.cashier_id}</div>
        </div>
        <div class="divider"></div>
        ${cart.map(item => `
          <div class="item">
            <span>${item.name} x${item.quantity}</span>
            <span>$${((item.unit_price * item.quantity) - ((item.unit_price * item.quantity * item.discount_percent) / 100)).toFixed(2)}</span>
          </div>
          ${item.discount_percent > 0 ? `<div class="small" style="margin-left: 20px;">Discount ${item.discount_percent}%</div>` : ''}
        `).join('')}
        <div class="divider"></div>
        <div class="item total">
          <span>TOTAL</span>
          <span>$${sale.total_amount.toFixed(2)}</span>
        </div>
        <div class="item">
          <span>Paid (${sale.payment_method})</span>
          <span>$${sale.amount_paid.toFixed(2)}</span>
        </div>
        <div class="item">
          <span>Change</span>
          <span>$${sale.change_amount.toFixed(2)}</span>
        </div>
        <div class="divider"></div>
        <div class="center small">Thank you for your purchase!</div>
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
      </html>
    `;

    receiptWindow.document.write(receiptHTML);
    receiptWindow.document.close();
  };

  const handlePayment = async () => {
    if (parseFloat(amountPaid) < total) {
      toast.error('Insufficient payment amount');
      return;
    }

    setIsProcessing(true);
    try {
      const items = cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
      }));

      const { data, error } = await supabase.functions.invoke('process-pos-sale', {
        body: {
          session_id: sessionId,
          outlet_id: outletId,
          items,
          payment_method: paymentMethod,
          amount_paid: parseFloat(amountPaid),
          tax_rate: 0, // Add tax configuration if needed
        },
      });

      if (error) throw error;

      // Fetch outlet details for receipt
      const { data: outletData } = await supabase
        .from('outlets')
        .select('name, address')
        .eq('id', outletId)
        .single();

      toast.success(`Sale completed: ${data.sale.sale_number}`);
      
      // Print receipt
      printReceipt(data.sale, outletData);
      
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickAmount = (amount: number) => {
    setAmountPaid(amount.toString());
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">Payment</h2>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Total */}
        <div className="bg-primary/10 rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-3xl font-bold">${total.toFixed(2)}</p>
        </div>

        {/* Payment Method */}
        <div className="space-y-3">
          <Label>Payment Method</Label>
          <RadioGroup value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
            <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="cash" id="cash" />
              <Label htmlFor="cash" className="flex items-center gap-2 cursor-pointer flex-1">
                <Banknote className="h-5 w-5" />
                Cash
              </Label>
            </div>
            <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="card" id="card" />
              <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer flex-1">
                <CreditCard className="h-5 w-5" />
                Card
              </Label>
            </div>
            <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-accent">
              <RadioGroupItem value="mobile_wallet" id="mobile" />
              <Label htmlFor="mobile" className="flex items-center gap-2 cursor-pointer flex-1">
                <Smartphone className="h-5 w-5" />
                Mobile Wallet
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Amount Paid */}
        <div className="space-y-2">
          <Label htmlFor="amount">Amount Paid</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            placeholder="0.00"
            className="text-xl font-semibold"
          />
        </div>

        {/* Quick Amount Buttons */}
        {paymentMethod === 'cash' && (
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 20, 50, 100, 500].map((amount) => (
              <Button
                key={amount}
                variant="outline"
                onClick={() => handleQuickAmount(amount)}
                size="sm"
              >
                ${amount}
              </Button>
            ))}
          </div>
        )}

        {/* Change */}
        {parseFloat(amountPaid) >= total && (
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm text-muted-foreground">Change</p>
            <p className="text-2xl font-bold text-green-600">${change.toFixed(2)}</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t">
        <Button 
          onClick={handlePayment}
          disabled={isProcessing || parseFloat(amountPaid) < total}
          className="w-full"
          size="lg"
        >
          {isProcessing ? 'Processing...' : 'Complete Payment'}
        </Button>
      </div>
    </div>
  );
};

export default PaymentPanel;
