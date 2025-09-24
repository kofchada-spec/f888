import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { ProfilePickerModal } from './ProfilePickerModal';

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
  const [selectedGender, setSelectedGender] = useState('Homme');
  const [selectedHeight, setSelectedHeight] = useState<number | null>(170);
  const [selectedWeight, setSelectedWeight] = useState<number | null>(70);
  const [selectedBirthDate, setSelectedBirthDate] = useState<Date | null>(new Date(1998, 0, 1));
  const [modalType, setModalType] = useState<'height' | 'weight' | 'birthDate' | null>(null);

  const { 
    handleSubmit, 
    formState: { errors }, 
    setValue, 
    trigger,
    watch
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange'
  });

  const formData = watch();

  // Initialize form with default values
  useEffect(() => {
    setValue('gender', 'Homme');
    setValue('height', 1.70); // 170cm in meters
    setValue('weight', 70);
    setValue('birthDate', '01/01/1998');
    trigger(); // Validate all fields
  }, [setValue, trigger]);

  const handlePickerConfirm = async (type: 'height' | 'weight' | 'birthDate', value: any) => {
    if (type === 'height') {
      const heightInMeters = value / 100; // Convert cm to meters
      setSelectedHeight(value);
      setValue('height', heightInMeters);
      await trigger('height');
    } else if (type === 'weight') {
      setSelectedWeight(value);
      setValue('weight', value);
      await trigger('weight');
    } else if (type === 'birthDate') {
      setSelectedBirthDate(value);
      const day = value.getDate().toString().padStart(2, '0');
      const month = (value.getMonth() + 1).toString().padStart(2, '0');
      const year = value.getFullYear();
      setValue('birthDate', `${day}/${month}/${year}`);
      await trigger('birthDate');
    }
    setModalType(null);
  };

  const handleGenderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedGender(value);
    setValue('gender', value);
    await trigger('gender');
  };

  const formatDisplayValue = (type: 'height' | 'weight' | 'birthDate') => {
    if (type === 'height' && selectedHeight) {
      return `${selectedHeight} cm`;
    } else if (type === 'weight' && selectedWeight) {
      return `${selectedWeight} kg`;
    } else if (type === 'birthDate' && selectedBirthDate) {
      const day = selectedBirthDate.getDate().toString().padStart(2, '0');
      const month = (selectedBirthDate.getMonth() + 1).toString().padStart(2, '0');
      const year = selectedBirthDate.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return '';
  };

  const isFormValid = selectedGender && selectedHeight && selectedWeight && selectedBirthDate;

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
        localStorage.setItem('userProfile', JSON.stringify(profileData));
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
              value={selectedGender}
              onChange={handleGenderChange}
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
              Taille
            </Label>
            <button
              type="button"
              onClick={() => setModalType('height')}
              className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-left",
                !selectedHeight && "text-muted-foreground",
                errors.height && "border-red-500 focus:border-red-500"
              )}
            >
              {formatDisplayValue('height') || 'Sélectionner votre taille'}
            </button>
            {errors.height && (
              <p className="text-sm text-red-600">{errors.height.message}</p>
            )}
          </div>

          {/* Poids */}
          <div className="space-y-2">
            <Label htmlFor="weight" className="text-sm font-medium text-gray-700">
              Poids
            </Label>
            <button
              type="button"
              onClick={() => setModalType('weight')}
              className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-left",
                !selectedWeight && "text-muted-foreground",
                errors.weight && "border-red-500 focus:border-red-500"
              )}
            >
              {formatDisplayValue('weight') || 'Sélectionner votre poids'}
            </button>
            {errors.weight && (
              <p className="text-sm text-red-600">{errors.weight.message}</p>
            )}
          </div>

          {/* Date de naissance */}
          <div className="space-y-2">
            <Label htmlFor="birthDate" className="text-sm font-medium text-gray-700">
              Date de naissance
            </Label>
            <button
              type="button"
              onClick={() => setModalType('birthDate')}
              className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-left",
                !selectedBirthDate && "text-muted-foreground",
                errors.birthDate && "border-red-500 focus:border-red-500"
              )}
            >
              {formatDisplayValue('birthDate') || 'Sélectionner votre date de naissance'}
            </button>
            {errors.birthDate && (
              <p className="text-sm text-red-600">{errors.birthDate.message}</p>
            )}
          </div>

          {/* Bouton Continuer */}
          <Button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="w-full h-12 text-base font-semibold rounded-[14px] bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isSubmitting ? 'Enregistrement...' : 'Continuer'}
          </Button>
        </form>

        {/* Profile Picker Modals */}
        {modalType && (
          <ProfilePickerModal
            isOpen={true}
            onClose={() => setModalType(null)}
            type={modalType}
            initialValue={
              modalType === 'height' ? selectedHeight :
              modalType === 'weight' ? selectedWeight :
              selectedBirthDate
            }
            onConfirm={(value) => handlePickerConfirm(modalType, value)}
          />
        )}

        {/* Message informatif */}
        <p className="text-xs text-gray-500 text-center mt-6 leading-relaxed">
          Ces infos permettent d'estimer précisément distance, temps et calories.
        </p>
      </div>
    </div>
  );
};

export default ProfileCompletion;