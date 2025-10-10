import { AlertCircle, X } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export const BetaBanner = () => {
  const [isVisible, setIsVisible] = useState(
    !localStorage.getItem('beta-banner-dismissed')
  );

  const handleDismiss = () => {
    localStorage.setItem('beta-banner-dismissed', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <Alert className="relative border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 mb-4 rounded-xl">
      <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
      <AlertDescription className="text-sm text-amber-800 dark:text-amber-200 pr-10">
        <strong>Version Bêta :</strong> Cette application est en phase de test. 
        Des bugs peuvent survenir. Votre feedback nous aide à l'améliorer ! 🚀
      </AlertDescription>
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900 rounded-lg"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
};
