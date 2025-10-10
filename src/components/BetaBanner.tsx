import { AlertCircle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface BetaBannerProps {
  forceShow?: boolean;
  onClose?: () => void;
}

export const BetaBanner = ({ forceShow = false, onClose }: BetaBannerProps = {}) => {
  const [isVisible, setIsVisible] = useState(
    forceShow || !localStorage.getItem('beta-banner-dismissed')
  );

  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
    }
  }, [forceShow]);

  const handleDismiss = () => {
    if (!forceShow) {
      localStorage.setItem('beta-banner-dismissed', 'true');
    }
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) return null;

  return (
    <Alert className="relative border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 mb-4 rounded-xl pl-12">
      <Button
        variant="ghost"
        size="sm"
        className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900 rounded-lg"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
      <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
        <strong>Version Bêta :</strong> Cette application est en phase de test. 
        Des bugs peuvent survenir. Votre feedback nous aide à l'améliorer ! 🚀
      </AlertDescription>
    </Alert>
  );
};
