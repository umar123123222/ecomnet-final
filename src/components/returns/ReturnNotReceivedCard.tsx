import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, FileWarning, Phone, Package, Truck, Calendar, Clock, AlertTriangle } from "lucide-react";
import { useCurrency } from '@/hooks/useCurrency';

interface ReturnNotReceived {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  returnReason: string | null;
  markedReturnedDate: string;
  daysSinceMarked: number;
  courier: string;
  trackingId: string | null;
  returnValue: number;
  isClaimed?: boolean;
  claimAmount?: number;
  claimStatus?: string;
  claimReference?: string;
}

interface ReturnNotReceivedCardProps {
  returnItem: ReturnNotReceived;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onView: (orderNumber: string) => void;
  onClaim?: (returnItem: ReturnNotReceived) => void;
  activeTab: 'awaiting' | 'claimed';
}

const ReturnNotReceivedCard = ({ 
  returnItem, 
  isSelected, 
  onSelect, 
  onView, 
  onClaim,
  activeTab 
}: ReturnNotReceivedCardProps) => {
  const { formatCurrency } = useCurrency();
  
  const getPriorityColor = (days: number) => {
    if (days >= 10) return 'bg-destructive/10 text-destructive border-destructive/30';
    if (days >= 7) return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
    if (days >= 3) return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
    return 'bg-muted text-muted-foreground border-border';
  };

  const getPriorityLabel = (days: number) => {
    if (days >= 10) return 'Critical';
    if (days >= 7) return 'High';
    if (days >= 3) return 'Medium';
    return 'Low';
  };

  const getClaimStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'settled': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';
      case 'approved': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400';
    }
  };

  return (
    <div className={`
      rounded-xl border bg-card p-4 space-y-3 transition-all duration-200
      ${isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:border-primary/30'}
    `}>
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(returnItem.id, checked as boolean)}
            className="mt-0.5"
          />
          <div>
            <p className="font-semibold text-foreground">{returnItem.orderNumber}</p>
            <p className="text-sm text-muted-foreground">{returnItem.customerName}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-foreground">
            {formatCurrency(activeTab === 'claimed' && returnItem.claimAmount 
              ? returnItem.claimAmount 
              : returnItem.returnValue
            )}
          </p>
          {activeTab === 'claimed' ? (
            <Badge variant="outline" className={`text-xs ${getClaimStatusColor(returnItem.claimStatus)}`}>
              {returnItem.claimStatus || 'pending'}
            </Badge>
          ) : (
            <Badge variant="outline" className={`text-xs ${getPriorityColor(returnItem.daysSinceMarked)}`}>
              {getPriorityLabel(returnItem.daysSinceMarked)}
            </Badge>
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {returnItem.customerPhone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{returnItem.customerPhone}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Truck className="h-3.5 w-3.5 shrink-0" />
          <span>{returnItem.courier}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground col-span-2">
          <Package className="h-3.5 w-3.5 shrink-0" />
          <span className="font-mono text-xs truncate">{returnItem.trackingId || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>{returnItem.markedReturnedDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className={`font-medium ${
            returnItem.daysSinceMarked >= 10 ? 'text-destructive' :
            returnItem.daysSinceMarked >= 7 ? 'text-orange-600 dark:text-orange-400' :
            returnItem.daysSinceMarked >= 3 ? 'text-yellow-600 dark:text-yellow-400' :
            'text-muted-foreground'
          }`}>
            {returnItem.daysSinceMarked} days
          </span>
        </div>
      </div>

      {/* Return Reason */}
      {returnItem.returnReason && returnItem.returnReason !== 'Not specified' && (
        <div className="bg-muted/50 rounded-lg p-2.5">
          <p className="text-xs text-muted-foreground line-clamp-2">
            <span className="font-medium">Reason:</span> {returnItem.returnReason}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={() => onView(returnItem.orderNumber)}
        >
          <Eye className="h-4 w-4 mr-2" />
          View Order
        </Button>
        {activeTab === 'awaiting' && returnItem.daysSinceMarked >= 7 && onClaim && (
          <Button 
            variant="outline" 
            size="sm"
            className="flex-1 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            onClick={() => onClaim(returnItem)}
          >
            <FileWarning className="h-4 w-4 mr-2" />
            File Claim
          </Button>
        )}
      </div>
    </div>
  );
};

export default ReturnNotReceivedCard;
