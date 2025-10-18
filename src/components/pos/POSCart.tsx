import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { POSCartItem } from '@/types/pos';
import { Trash2, Minus, Plus } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCurrency } from '@/utils/currency';

interface POSCartProps {
  items: POSCartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdateDiscount: (productId: string, discount: number) => void;
  onRemoveItem: (productId: string) => void;
}

const POSCart = ({ items, onUpdateQuantity, onUpdateDiscount, onRemoveItem }: POSCartProps) => {
  const { currency } = useCurrency();
  
  const calculateLineTotal = (item: POSCartItem) => {
    const discount = (item.unit_price * item.quantity * item.discount_percent) / 100;
    return (item.unit_price * item.quantity) - discount;
  };

  const subtotal = items.reduce((sum, item) => sum + calculateLineTotal(item), 0);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Cart is empty
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {items.map((item) => (
        <div key={item.product_id} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-sm">{item.name}</h4>
              <p className="text-xs text-muted-foreground">{item.sku}</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemoveItem(item.product_id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              type="number"
              value={item.quantity}
              onChange={(e) => onUpdateQuantity(item.product_id, parseInt(e.target.value) || 0)}
              className="w-16 text-center"
              min="1"
              max={item.available_quantity}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
              disabled={item.quantity >= item.available_quantity}
            >
              <Plus className="h-3 w-3" />
            </Button>
            <span className="text-sm font-medium ml-auto">
              {formatCurrency(item.unit_price, currency)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Discount %:</span>
            <Input
              type="number"
              value={item.discount_percent}
              onChange={(e) => onUpdateDiscount(item.product_id, parseFloat(e.target.value) || 0)}
              className="w-20 text-sm"
              min="0"
              max="100"
              step="1"
            />
            <span className="text-sm font-semibold ml-auto">
              {formatCurrency(calculateLineTotal(item), currency)}
            </span>
          </div>
        </div>
      ))}

      <div className="border-t pt-3 mt-4">
        <div className="flex justify-between text-lg font-bold">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal, currency)}</span>
        </div>
      </div>
    </div>
  );
};

export default POSCart;
