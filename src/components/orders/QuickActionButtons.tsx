import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Truck, FileText, Activity, MoreVertical, CheckCircle } from 'lucide-react';
import { useUserRoles } from '@/hooks/useUserRoles';

interface QuickActionButtonsProps {
  orderId: string;
  orderStatus: string;
  onMarkDispatched: (orderId: string) => void;
  onGenerateLabel: (orderId: string) => void;
  onViewActivity: (orderId: string) => void;
  onViewDetails: (orderId: string) => void;
}

export const QuickActionButtons: React.FC<QuickActionButtonsProps> = ({
  orderId,
  orderStatus,
  onMarkDispatched,
  onGenerateLabel,
  onViewActivity,
  onViewDetails,
}) => {
  const { isManager, isSeniorStaff, primaryRole } = useUserRoles();
  
  const canUpdateStatus = isManager() || isSeniorStaff() || primaryRole === 'staff';
  const canDispatch = orderStatus === 'booked' && canUpdateStatus;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover-scale">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover z-50 border shadow-lg">
        <DropdownMenuItem onClick={() => onViewDetails(orderId)} className="gap-2 hover:bg-accent/10">
          <FileText className="h-4 w-4" />
          View Details
        </DropdownMenuItem>
        
        {canDispatch && (
          <DropdownMenuItem onClick={() => onMarkDispatched(orderId)} className="gap-2 hover:bg-accent/10">
            <CheckCircle className="h-4 w-4" />
            Mark as Dispatched
          </DropdownMenuItem>
        )}
        
        <DropdownMenuItem onClick={() => onGenerateLabel(orderId)} className="gap-2 hover:bg-accent/10">
          <Truck className="h-4 w-4" />
          Generate Label
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => onViewActivity(orderId)} className="gap-2 hover:bg-accent/10">
          <Activity className="h-4 w-4" />
          View Activity Log
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};