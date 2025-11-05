import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, RefreshCw, X } from "lucide-react";

export function CustomerSyncControl() {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState({ saved: 0, fetched: 0, total: 0, errors: 0 });
  const [runId, setRunId] = useState<string | null>(null);
  const [nextPageInfo, setNextPageInfo] = useState<string | null>(null);

  const startSync = async () => {
    setSyncing(true);
    setProgress({ saved: 0, fetched: 0, total: 0, errors: 0 });
    setRunId(null);
    setNextPageInfo(null);
    
    try {
      await syncPage();
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
      setSyncing(false);
    }
  };

  const syncPage = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-shopify-customers', {
        body: {
          runId: runId || undefined,
          pageInfo: nextPageInfo || undefined,
          maxPages: 5,
        },
      });

      if (error) throw error;

      if (data.error) {
        if (data.error.includes('already in progress')) {
          toast({
            title: "Sync In Progress",
            description: "A sync is already running. Please wait or resume it.",
            variant: "default",
          });
          setSyncing(false);
          return;
        }
        throw new Error(data.error);
      }

      setRunId(data.runId);
      setNextPageInfo(data.nextPageInfo);
      setProgress({
        saved: data.processed || 0,
        fetched: data.fetched || 0,
        total: data.totalCount || data.processed || 0,
        errors: data.errors || 0,
      });

      if (data.hasMore) {
        // Continue syncing automatically
        await new Promise(resolve => setTimeout(resolve, 1000));
        await syncPage();
      } else {
        // Sync complete
        toast({
          title: "Sync Complete",
          description: data.message,
        });
        setSyncing(false);
        setRunId(null);
        setNextPageInfo(null);
      }
    } catch (error: any) {
      throw error;
    }
  };

  const cancelSync = async () => {
    if (!runId) {
      setSyncing(false);
      return;
    }

    try {
      // Call the cancel edge function to mark as cancelled in DB
      await supabase.functions.invoke('cancel-shopify-syncs', {
        body: { types: ['customers'], statuses: ['in_progress'] },
      });

      setSyncing(false);
      toast({
        title: "Sync Cancelled",
        description: "Customer sync has been stopped and marked as cancelled.",
      });
    } catch (error: any) {
      console.error('Cancel error:', error);
      setSyncing(false);
      toast({
        title: "Sync Stopped",
        description: "Sync has been stopped locally.",
      });
    }
  };

  const resumeSync = async () => {
    if (!runId || !nextPageInfo) {
      toast({
        title: "Cannot Resume",
        description: "No sync session to resume",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    try {
      await syncPage();
    } catch (error: any) {
      toast({
        title: "Resume Failed",
        description: error.message,
        variant: "destructive",
      });
      setSyncing(false);
    }
  };

  const progressPercent = progress.total > 0 
    ? Math.round((progress.saved / progress.total) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Customer Sync
        </CardTitle>
        <CardDescription>
          Sync customer records from Shopify
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {syncing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Saved {progress.saved.toLocaleString()} / Fetched {progress.fetched.toLocaleString()}
                {progress.total > 0 && ` of ${progress.total.toLocaleString()}`}
              </span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            {progress.errors > 0 && (
              <div className="text-xs text-destructive">
                ⚠️ {progress.errors} errors occurred during sync
              </div>
            )}
            <Progress value={progressPercent} />
          </div>
        )}

        <div className="flex gap-2">
          {!syncing && !runId && (
            <Button onClick={startSync} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              Start Full Sync
            </Button>
          )}

          {!syncing && runId && nextPageInfo && (
            <Button onClick={resumeSync} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              Resume Sync
            </Button>
          )}

          {syncing && (
            <>
              <Button disabled className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </Button>
              <Button variant="outline" onClick={cancelSync}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </>
          )}
        </div>

        {runId && !syncing && (
          <p className="text-xs text-muted-foreground">
            Sync session: {runId.slice(0, 8)}... • 
            {nextPageInfo ? ' Ready to resume' : ' Complete'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
