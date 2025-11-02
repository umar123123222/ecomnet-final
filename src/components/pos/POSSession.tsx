import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { POSSession as POSSessionType } from '@/types/pos';
import { DoorOpen, DoorClosed } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { formatCurrency } from '@/utils/currency';

interface POSSessionProps {
  currentSession?: POSSessionType | null;
  onSessionOpened?: (session: POSSessionType) => void;
  onSessionClosed?: () => void;
}

const POSSession = ({ currentSession, onSessionOpened, onSessionClosed }: POSSessionProps) => {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [outletId, setOutletId] = useState('');
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Fetch sessions from last 7 days
  const { data: recentSessions } = useQuery({
    queryKey: ['recent-pos-sessions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data, error } = await supabase
        .from('pos_sessions')
        .select('session_number, opening_cash, closing_cash, opened_at, closed_at, status')
        .eq('cashier_id', user.id)
        .eq('status', 'closed')
        .gte('closed_at', sevenDaysAgo.toISOString())
        .order('closed_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch accessible outlets for the current user
  const { data: accessibleOutlets } = useQuery({
    queryKey: ['accessible-outlets', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get user role to check if super admin/manager
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      const isSuperUser = userRoleData?.role === 'super_admin' || userRoleData?.role === 'super_manager';

      if (isSuperUser) {
        // Super users can access all outlets
        const { data, error } = await supabase
          .from('outlets')
          .select('id, name, outlet_type')
          .eq('is_active', true);
        if (error) throw error;
        return data;
      }

      // Get outlets where user is manager
      const { data: managedOutlets } = await supabase
        .from('outlets')
        .select('id, name, outlet_type')
        .eq('manager_id', user.id)
        .eq('is_active', true);

      // Get outlets where user has staff assignment with POS access
      const { data: staffOutlets } = await supabase
        .from('outlet_staff')
        .select('outlet_id, outlets(id, name, outlet_type)')
        .eq('user_id', user.id)
        .eq('can_access_pos', true);

      const staffOutletData = staffOutlets?.map(s => s.outlets).filter(Boolean) || [];

      // Combine and deduplicate
      const allOutlets = [...(managedOutlets || []), ...staffOutletData];
      const uniqueOutlets = Array.from(new Map(allOutlets.map(o => [o.id, o])).values());

      return uniqueOutlets;
    },
    enabled: !!user?.id,
  });

  // Auto-select first accessible outlet
  useEffect(() => {
    if (accessibleOutlets && accessibleOutlets.length > 0 && !outletId) {
      setOutletId(accessibleOutlets[0].id);
    }
  }, [accessibleOutlets, outletId]);

  const handleOpenSession = async () => {
    if (!outletId || !openingCash) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('open-pos-session', {
        body: {
          outlet_id: outletId,
          opening_cash: parseFloat(openingCash),
        },
      });

      if (error) throw error;

      toast.success('Session opened successfully');
      setOpenDialogOpen(false);
      if (onSessionOpened && data.session) {
        onSessionOpened(data.session);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to open session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseSession = async () => {
    if (!currentSession || !closingCash) {
      toast.error('Please enter closing cash amount');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('close-pos-session', {
        body: {
          session_id: currentSession.id,
          closing_cash: parseFloat(closingCash),
          notes,
        },
      });

      if (error) throw error;

      const difference = data.cash_difference;
      if (Math.abs(difference) > 0.01) {
        toast.warning(`Session closed. Cash difference: ${difference >= 0 ? '+' : ''}${formatCurrency(Math.abs(difference), currency)}`);
      } else {
        toast.success('Session closed successfully');
      }
      
      setCloseDialogOpen(false);
      if (onSessionClosed) {
        onSessionClosed();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to close session');
    } finally {
      setIsLoading(false);
    }
  };

  if (!currentSession) {
    return (
      <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
        <DialogTrigger asChild>
          <Button size="lg" className="w-full max-w-md">
            <DoorOpen className="mr-2 h-5 w-5" />
            Open Session
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open POS Session</DialogTitle>
          </DialogHeader>
          
          {/* Recent Sessions History */}
          {recentSessions && recentSessions.length > 0 && (
            <div className="border rounded-lg p-3 mb-4 bg-muted/50">
              <h4 className="text-sm font-semibold mb-2">Recent Sessions (Last 7 Days)</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {recentSessions.map((session) => (
                  <div key={session.session_number} className="flex justify-between text-xs border-b pb-1">
                    <div>
                      <div className="font-medium">{session.session_number}</div>
                      <div className="text-muted-foreground">
                        {new Date(session.closed_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div>Open: {formatCurrency(session.opening_cash, currency)}</div>
                      <div>Close: {formatCurrency(session.closing_cash || 0, currency)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 py-4">
            <div>
              <Label>Assigned Outlet</Label>
              {accessibleOutlets && accessibleOutlets.length > 0 ? (
                <div className="border rounded-md p-3 bg-muted">
                  <p className="font-medium">{accessibleOutlets[0].name}</p>
                  <p className="text-sm text-muted-foreground">{accessibleOutlets[0].outlet_type}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground border rounded-md p-4 bg-muted">
                  You don't have POS access to any outlets yet. Please contact your store manager.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="opening-cash">Opening Cash *</Label>
              <Input
                id="opening-cash"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
              />
            </div>
            <Button onClick={handleOpenSession} disabled={isLoading} className="w-full">
              {isLoading ? 'Opening...' : 'Open Session'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Card className="px-4 py-2">
        <p className="text-sm text-muted-foreground">Opening Cash</p>
        <p className="text-lg font-semibold">{formatCurrency(currentSession.opening_cash, currency)}</p>
      </Card>
      
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive">
            <DoorClosed className="mr-2 h-4 w-4" />
            Close Session
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close POS Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Session Number</p>
              <p className="font-semibold">{currentSession.session_number}</p>
              <p className="text-sm text-muted-foreground mt-2">Opening Cash</p>
              <p className="font-semibold">{formatCurrency(currentSession.opening_cash, currency)}</p>
            </div>
            <div>
              <Label htmlFor="closing-cash">Closing Cash *</Label>
              <Input
                id="closing-cash"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button onClick={handleCloseSession} disabled={isLoading} className="w-full">
              {isLoading ? 'Closing...' : 'Close Session'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POSSession;
