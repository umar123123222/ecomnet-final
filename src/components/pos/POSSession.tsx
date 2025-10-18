import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { POSSession as POSSessionType } from '@/types/pos';
import { DoorOpen, DoorClosed } from 'lucide-react';

interface POSSessionProps {
  currentSession?: POSSessionType | null;
  onSessionOpened?: (session: POSSessionType) => void;
  onSessionClosed?: () => void;
}

const POSSession = ({ currentSession, onSessionOpened, onSessionClosed }: POSSessionProps) => {
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [outletId, setOutletId] = useState('');
  const [registerNumber, setRegisterNumber] = useState('');
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
          register_number: registerNumber,
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
        toast.warning(`Session closed. Cash difference: ${difference >= 0 ? '+' : ''}${difference.toFixed(2)}`);
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
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="outlet">Outlet *</Label>
              <Input
                id="outlet"
                placeholder="Enter outlet ID"
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="register">Register Number</Label>
              <Input
                id="register"
                placeholder="e.g., REG-01"
                value={registerNumber}
                onChange={(e) => setRegisterNumber(e.target.value)}
              />
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
        <p className="text-lg font-semibold">${currentSession.opening_cash.toFixed(2)}</p>
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
              <p className="font-semibold">${currentSession.opening_cash.toFixed(2)}</p>
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
