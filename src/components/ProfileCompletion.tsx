import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface ProfileCompletionProps {
  onComplete: () => void;
}

const profileSchema = z.object({
  gender: z.string().min(1, "Veuillez sélectionner votre genre"),
  height: z.number()
    .min(1.0, "Entrez une taille entre 1,00 et 2,30 m")
    .max(2.3, "Entrez une taille entre 1,00 et 2,30 m"),
  weight: z.number()
    .min(30, "Entrez un poids entre 30 et 250 kg")
    .max(250, "Entrez un poids entre 30 et 250 kg"),
  birthDate: z.string()
    .min(1, "Veuillez entrer votre date de naissance")
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Format requis : JJ/MM/AAAA")
    .refine((dateStr) => {
      const [day, month, year] = dateStr.split('/').map(Number);
      const date = new Date(year, month - 1, day);
      
      // Vérifier que la date est valide
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        return false;
      }
      
      // Vérifier l'âge minimum
      const today = new Date();
      const age = today.getFullYear() - year;
      const monthDiff = today.getMonth() - (month - 1);
      const finalAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < day) ? age - 1 : age;
      return finalAge >= 13;
    }, "Date invalide ou âge minimum requis : 13 ans")
});

type ProfileFormData = z.infer<typeof profileSchema>;

const ProfileCompletion = ({ onComplete }: ProfileCompletionProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [heightInput, setHeightInput] = useState('');
  const [weightInput, setWeightInput] = useState('');

  const { 
    register, 
    handleSubmit, 
    formState: { errors, isValid }, 
    setValue, 
    trigger
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange'
  });

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

  const onSubmit = async (data: ProfileFormData) => {
    setIsSubmitting(true);
    
    try {
      // Parse the birth date string and calculate age
      const [day, month, year] = data.birthDate.split('/').map(Number);
      const birthDate = new Date(year, month - 1, day);
      
      const today = new Date();
      const age = today.getFullYear() - year;
      const monthDiff = today.getMonth() - (month - 1);
      const finalAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < day) ? age - 1 : age;

      if (user) {
        // Save to Supabase profiles table if user is authenticated
        const { supabase } = await import('@/integrations/supabase/client');
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            gender: data.gender,
            height_m: data.height,
            weight_kg: data.weight,
            birth_date: birthDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
            age_years: finalAge
          })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('Error saving profile:', updateError);
          throw updateError;
        }
      } else {
        // If no user (auth skipped), store in localStorage
        const profileData = {
          gender: data.gender,
          height_m: data.height,
          weight_kg: data.weight,
          birth_date: birthDate.toISOString().split('T')[0],
          age_years: finalAge
        };
        localStorage.setItem('fitpas-profile-data', JSON.stringify(profileData));
      }
      
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
          {/* Genre */}
          <div className="space-y-2">
            <Label htmlFor="gender" className="text-sm font-medium text-gray-700">
              Genre
            </Label>
            <select
              id="gender"
              {...register('gender')}
              className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                errors.gender && "border-red-500 focus:border-red-500"
              )}
            >
              <option value="">Sélectionner</option>
              <option value="Homme">Homme</option>
              <option value="Femme">Femme</option>
              <option value="Autre">Autre</option>
            </select>
            {errors.gender && (
              <p className="text-sm text-red-600">{errors.gender.message}</p>
            )}
          </div>

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
            <Input
              id="birthDate"
              type="text"
              placeholder="JJ/MM/AAAA"
              {...register('birthDate')}
              className={cn(
                "text-base",
                errors.birthDate && "border-red-500 focus:border-red-500"
              )}
            />
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