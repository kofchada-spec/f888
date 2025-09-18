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
          <div className="flex items-center mb-6">
            <WheelPicker
              options={heights}
              value={heightValue}
              onChange={(value) => setHeightValue(value as number)}
              height={240}
              className="w-24"
            />
            <span className="ml-2 text-lg font-medium text-gray-600">cm</span>
          </div>
        </div>
      );
    }

    if (type === 'weight') {
      const weights = Array.from({ length: 221 }, (_, i) => i + 30); // 30kg à 250kg
      
      return (
        <div className="flex flex-col items-center">
          <div className="flex items-center mb-6">
            <WheelPicker
              options={weights}
              value={weightValue}
              onChange={(value) => setWeightValue(value as number)}
              height={240}
              className="w-24"
            />
            <span className="ml-2 text-lg font-medium text-gray-600">kg</span>
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
        <div className="flex justify-center items-center space-x-4 mb-6">
          <WheelPicker
            options={days}
            value={birthDateValue.day}
            onChange={(value) => setBirthDateValue(prev => ({ ...prev, day: value as number }))}
            height={240}
            className="w-16"
          />
          <WheelPicker
            options={months}
            value={months[birthDateValue.month]}
            onChange={(value) => {
              const monthIndex = months.indexOf(value as string);
              setBirthDateValue(prev => ({ ...prev, month: monthIndex }));
            }}
            height={240}
            className="w-32"
          />
          <WheelPicker
            options={years}
            value={birthDateValue.year}
            onChange={(value) => setBirthDateValue(prev => ({ ...prev, year: value as number }))}
            height={240}
            className="w-20"
          />
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
      <DialogContent className="sm:max-w-md mx-auto rounded-3xl p-0 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-b">
          <h2 className="text-lg font-semibold text-gray-900">{getTitle()}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-6 py-8">
          {renderContent()}
        </div>
        
        <div className="px-6 pb-6">
          <Button
            onClick={handleConfirm}
            className="w-full h-12 text-white font-semibold rounded-2xl"
            style={{ backgroundColor: '#FF6B35' }}
          >
            Valider
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};