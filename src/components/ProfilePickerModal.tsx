import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { WheelPicker } from './WheelPicker';

interface ProfilePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'height' | 'weight' | 'birthDate';
  initialValue?: any;
  onConfirm: (value: any) => void;
}

export const ProfilePickerModal = ({ 
  isOpen, 
  onClose, 
  type, 
  initialValue, 
  onConfirm 
}: ProfilePickerModalProps) => {
  // Separate states for different types
  const [heightValue, setHeightValue] = useState(() => 
    type === 'height' ? (initialValue || 170) : 170
  );
  const [weightValue, setWeightValue] = useState(() => 
    type === 'weight' ? (initialValue || 70) : 70
  );
  const [birthDateValue, setBirthDateValue] = useState(() => {
    if (type === 'birthDate') {
      const defaultDate = initialValue ? new Date(initialValue) : new Date(2000, 3, 20); // 20 Avril 2000
      return {
        day: defaultDate.getDate(),
        month: defaultDate.getMonth(),
        year: defaultDate.getFullYear()
      };
    }
    return { day: 20, month: 3, year: 2000 };
  });

  const handleConfirm = () => {
    if (type === 'birthDate') {
      const { day, month, year } = birthDateValue;
      const date = new Date(year, month, day);
      onConfirm(date);
    } else if (type === 'height') {
      onConfirm(heightValue);
    } else if (type === 'weight') {
      onConfirm(weightValue);
    }
    onClose();
  };

  const renderContent = () => {
    if (type === 'height') {
      const heights = Array.from({ length: 131 }, (_, i) => i + 100); // 100cm à 230cm
      
      return (
        <div className="flex flex-col items-center">
          <div className="flex items-center mb-8">
            <WheelPicker
              options={heights}
              value={heightValue}
              onChange={(value) => setHeightValue(value as number)}
              height={280}
              className="w-28"
            />
            <span className="ml-4 font-inter text-2xl font-bold text-primary">cm</span>
          </div>
          <div className="text-center">
            <p className="font-inter text-sm text-muted-foreground">
              Sélectionnez votre taille
            </p>
          </div>
        </div>
      );
    }

    if (type === 'weight') {
      const weights = Array.from({ length: 221 }, (_, i) => i + 30); // 30kg à 250kg
      
      return (
        <div className="flex flex-col items-center">
          <div className="flex items-center mb-8">
            <WheelPicker
              options={weights}
              value={weightValue}
              onChange={(value) => setWeightValue(value as number)}
              height={280}
              className="w-28"
            />
            <span className="ml-4 font-inter text-2xl font-bold text-primary">kg</span>
          </div>
          <div className="text-center">
            <p className="font-inter text-sm text-muted-foreground">
              Sélectionnez votre poids
            </p>
          </div>
        </div>
      );
    }

    if (type === 'birthDate') {
      const days = Array.from({ length: 31 }, (_, i) => i + 1);
      const months = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];
      const currentYear = new Date().getFullYear();
      const years = Array.from({ length: 100 }, (_, i) => currentYear - i); // From current year to 100 years ago

      return (
        <div className="flex flex-col items-center">
          <div className="flex justify-center items-center space-x-6 mb-8">
            <div className="text-center">
              <WheelPicker
                options={days}
                value={birthDateValue.day}
                onChange={(value) => setBirthDateValue(prev => ({ ...prev, day: value as number }))}
                height={280}
                className="w-20"
              />
              <p className="font-inter text-xs text-muted-foreground mt-2">Jour</p>
            </div>
            <div className="text-center">
              <WheelPicker
                options={months}
                value={months[birthDateValue.month]}
                onChange={(value) => {
                  const monthIndex = months.indexOf(value as string);
                  setBirthDateValue(prev => ({ ...prev, month: monthIndex }));
                }}
                height={280}
                className="w-36"
              />
              <p className="font-inter text-xs text-muted-foreground mt-2">Mois</p>
            </div>
            <div className="text-center">
              <WheelPicker
                options={years}
                value={birthDateValue.year}
                onChange={(value) => setBirthDateValue(prev => ({ ...prev, year: value as number }))}
                height={280}
                className="w-24"
              />
              <p className="font-inter text-xs text-muted-foreground mt-2">Année</p>
            </div>
          </div>
          <div className="text-center">
            <p className="font-inter text-sm text-muted-foreground">
              Sélectionnez votre date de naissance
            </p>
          </div>
        </div>
      );
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'height': return 'Taille';
      case 'weight': return 'Poids';
      case 'birthDate': return 'Date de naissance';
      default: return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md mx-auto rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
        <div className="bg-card px-6 py-5 flex items-center justify-between border-b border-border/50">
          <h2 className="font-inter text-xl font-bold text-foreground">{getTitle()}</h2>
          <button
            onClick={onClose}
            className="text-foreground/70 hover:text-foreground hover:bg-muted/80 transition-all duration-200 p-2 rounded-full border border-border/30 hover:border-border/60 shadow-sm hover:shadow-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-6 py-10 bg-gradient-to-br from-background via-background to-muted/10">
          {renderContent()}
        </div>
        
        <div className="px-6 pb-6 bg-card">
          <Button
            onClick={handleConfirm}
            className="font-inter w-full h-14 text-lg font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
          >
            Valider
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};