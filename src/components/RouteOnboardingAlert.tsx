import { useState, useEffect } from 'react';
import { Info, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface RouteOnboardingAlertProps {
  isVisible: boolean;
  activityType: 'walk' | 'run';
}

const RouteOnboardingAlert = ({ isVisible, activityType }: RouteOnboardingAlertProps) => {
  const [showAlert, setShowAlert] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  
  const storageKey = 'fitpas-route-onboarding-dismissed';

  useEffect(() => {
    if (isVisible) {
      const dismissed = localStorage.getItem(storageKey);
      if (!dismissed) {
        setShowAlert(true);
      }
    }
  }, [isVisible]);

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(storageKey, 'true');
    }
    setShowAlert(false);
  };

  if (!showAlert) return null;

  return (
    <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      <Alert className="relative bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/30 shadow-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <AlertDescription className="text-foreground">
              <p className="font-medium mb-2">
                💡 Conseil important
              </p>
              <p className="text-sm leading-relaxed">
                Confirmez votre itinéraire en appuyant sur <strong>"Commencer la {activityType === 'walk' ? 'marche' : 'course'}"</strong> avant de quitter cette page, sinon votre sélection sera perdue.
              </p>
            </AlertDescription>
            
            <div className="flex items-center space-x-2 pt-2 border-t border-primary/20">
              <Checkbox 
                id="dont-show" 
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
                className="border-primary/50"
              />
              <Label 
                htmlFor="dont-show" 
                className="text-xs text-muted-foreground cursor-pointer select-none"
              >
                Ne plus afficher ce message
              </Label>
            </div>
          </div>
          
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-sm hover:bg-primary/10"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </Alert>
    </div>
  );
};

export default RouteOnboardingAlert;
