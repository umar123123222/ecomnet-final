import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

const VersionChecker = () => {
  const { toast } = useToast();

  useEffect(() => {
    const currentVersion = localStorage.getItem('app_version');
    const newVersion = import.meta.env.VITE_APP_VERSION || '2.0.0';
    
    if (currentVersion && currentVersion !== newVersion) {
      toast({
        title: "New Version Available",
        description: "A new version of the app is available. Please refresh to get the latest updates.",
        duration: 10000,
        action: (
          <Button 
            size="sm"
            onClick={() => window.location.reload()}
          >
            Refresh Now
          </Button>
        ),
      });
    }
    
    localStorage.setItem('app_version', newVersion);
  }, [toast]);

  return null;
};

export default VersionChecker;
