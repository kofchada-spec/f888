import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ProfileCompletionProps {
  onComplete: () => void;
}

const profileSchema = z.object({
  height: z.number()
    .min(1.0, "Entrez une taille entre 1,00 et 2,30 m")
    .max(2.3, "Entrez une taille entre 1,00 et 2,30 m"),
  weight: z.number()
    .min(30, "Entrez un poids entre 30 et 250 kg")
    .max(250, "Entrez un poids entre 30 et 250 kg"),
  birthDate: z.date({
    required_error: "Veuillez sélectionner votre date de naissance"
  }).refine((date) => {
    const today = new Date();
    const age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    const finalAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate()) ? age - 1 : age;
    return finalAge >= 13;
  }, "Vous devez avoir au moins 13 ans")
});

type ProfileFormData = z.infer<typeof profileSchema>;

const ProfileCompletion = ({ onComplete }: ProfileCompletionProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');

  const { 
    register, 
    handleSubmit, 
    formState: { errors, isValid }, 
    setValue, 
    watch,
    trigger
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange'
  });

  const selectedDate = watch('birthDate');

  const handleHeightChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHeightInput(value);
    
    const numValue = parseFloat(value.replace(',', '.'));
    if (!isNaN(numValue)) {
      setValue('height', numValue);
      await trigger('height');
    }
  };

  const handleWeightChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setWeightInput(value);
    
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setValue('weight', numValue);
      await trigger('weight');
    }
  };

  const handleDateSelect = async (date: Date | undefined) => {
    if (date) {
      setValue('birthDate', date);
      await trigger('birthDate');
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setIsSubmitting(true);
    
    try {
      // Calculate age
      const today = new Date();
      const age = today.getFullYear() - data.birthDate.getFullYear();
      const monthDiff = today.getMonth() - data.birthDate.getMonth();
      const finalAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < data.birthDate.getDate()) ? age - 1 : age;

      // Here you would save to Supabase
      const profileData = {
        heightM: data.height,
        weightKg: data.weight,
        birthDate: data.birthDate.toISOString(),
        ageYears: finalAge
      };

      console.log('Profile data to save:', profileData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onComplete();
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Complète ton profil
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Taille */}
          <div className="space-y-2">
            <Label htmlFor="height" className="text-sm font-medium text-gray-700">
              Taille (m)
            </Label>
            <Input
              id="height"
              type="text"
              inputMode="decimal"
              placeholder="1,68"
              value={heightInput}
              onChange={handleHeightChange}
              className={cn(
                "text-base",
                errors.height && "border-red-500 focus:border-red-500"
              )}
            />
            {errors.height && (
              <p className="text-sm text-red-600">{errors.height.message}</p>
            )}
          </div>

          {/* Poids */}
          <div className="space-y-2">
            <Label htmlFor="weight" className="text-sm font-medium text-gray-700">
              Poids (kg)
            </Label>
            <Input
              id="weight"
              type="number"
              inputMode="numeric"
              placeholder="70"
              value={weightInput}
              onChange={handleWeightChange}
              className={cn(
                "text-base",
                errors.weight && "border-red-500 focus:border-red-500"
              )}
            />
            {errors.weight && (
              <p className="text-sm text-red-600">{errors.weight.message}</p>
            )}
          </div>

          {/* Date de naissance */}
          <div className="space-y-2">
            <Label htmlFor="birthDate" className="text-sm font-medium text-gray-700">
              Date de naissance
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal text-base h-10",
                    !selectedDate && "text-muted-foreground",
                    errors.birthDate && "border-red-500"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "d MMMM yyyy", { locale: fr })
                  ) : (
                    <span>Sélectionner une date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                  className="p-3 pointer-events-auto"
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
            {errors.birthDate && (
              <p className="text-sm text-red-600">{errors.birthDate.message}</p>
            )}
          </div>

          {/* Bouton Continuer */}
          <Button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full h-12 text-base font-semibold rounded-[14px] bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isSubmitting ? 'Enregistrement...' : 'Continuer'}
          </Button>
        </form>

        {/* Message informatif */}
        <p className="text-xs text-gray-500 text-center mt-6 leading-relaxed">
          Ces infos permettent d'estimer précisément distance, temps et calories.
        </p>
      </div>
    </div>
  );
};

export default ProfileCompletion;