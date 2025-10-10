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
    <Alert className="relative border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 mb-4 rounded-xl pr-12">
      <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
      <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
        <strong>Version Bêta :</strong> Cette application est en phase de test. 
        Des bugs peuvent survenir. Votre feedback nous aide à l'améliorer ! 🚀
      </AlertDescription>
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-2 top-2 h-7 w-7 p-0 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900 rounded-lg"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
};
