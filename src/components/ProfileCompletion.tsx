import { useState } from 'react';
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
  const [selectedGender, setSelectedGender] = useState('');
  const [selectedHeight, setSelectedHeight] = useState<number | null>(null);
  const [selectedWeight, setSelectedWeight] = useState<number | null>(null);
  const [selectedBirthDate, setSelectedBirthDate] = useState<Date | null>(null);
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

  const getPlaceholder = (type: 'height' | 'weight' | 'birthDate') => {
    switch (type) {
      case 'height': return 'Choisir la taille';
      case 'weight': return 'Choisir le poids';
      case 'birthDate': return 'Choisir la date';
      default: return '';
    }
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl p-8 border border-border/50">
        <div className="text-center mb-10">
          <h1 className="font-inter text-3xl font-black text-foreground mb-3 tracking-tight">
            Complète ton profil
          </h1>
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="h-0.5 w-8 bg-gradient-to-r from-primary to-transparent"></div>
            <div className="h-1 w-1 rounded-full bg-primary"></div>
            <div className="h-0.5 w-8 bg-gradient-to-l from-primary to-transparent"></div>
          </div>
          <p className="font-inter text-muted-foreground text-sm font-light">
            Quelques infos pour personnaliser tes objectifs
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Genre */}
          <div className="space-y-3">
            <Label htmlFor="gender" className="font-inter text-sm font-semibold text-foreground">
              Genre
            </Label>
            <select
              id="gender"
              value={selectedGender}
              onChange={handleGenderChange}
              className={cn(
                "font-inter flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-base transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
                errors.gender && "border-destructive focus:border-destructive focus:ring-destructive/20"
              )}
            >
              <option value="">Sélectionner</option>
              <option value="Homme">Homme</option>
              <option value="Femme">Femme</option>
              <option value="Autre">Autre</option>
            </select>
            {errors.gender && (
              <p className="font-inter text-sm text-destructive font-medium">{errors.gender.message}</p>
            )}
          </div>

          {/* Taille */}
          <div className="space-y-3">
            <Label htmlFor="height" className="font-inter text-sm font-semibold text-foreground">
              Taille
            </Label>
            <button
              type="button"
              onClick={() => setModalType('height')}
              className={cn(
                "font-inter flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-base transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-left hover:border-primary/60",
                !selectedHeight && "text-muted-foreground",
                errors.height && "border-destructive focus:border-destructive focus:ring-destructive/20"
              )}
            >
              <span className="truncate">
                {formatDisplayValue('height') || getPlaceholder('height')}
              </span>
            </button>
            {errors.height && (
              <p className="font-inter text-sm text-destructive font-medium">{errors.height.message}</p>
            )}
          </div>

          {/* Poids */}
          <div className="space-y-3">
            <Label htmlFor="weight" className="font-inter text-sm font-semibold text-foreground">
              Poids
            </Label>
            <button
              type="button"
              onClick={() => setModalType('weight')}
              className={cn(
                "font-inter flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-base transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-left hover:border-primary/60",
                !selectedWeight && "text-muted-foreground",
                errors.weight && "border-destructive focus:border-destructive focus:ring-destructive/20"
              )}
            >
              <span className="truncate">
                {formatDisplayValue('weight') || getPlaceholder('weight')}
              </span>
            </button>
            {errors.weight && (
              <p className="font-inter text-sm text-destructive font-medium">{errors.weight.message}</p>
            )}
          </div>

          {/* Date de naissance */}
          <div className="space-y-3">
            <Label htmlFor="birthDate" className="font-inter text-sm font-semibold text-foreground">
              Date de naissance
            </Label>
            <button
              type="button"
              onClick={() => setModalType('birthDate')}
              className={cn(
                "font-inter flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-base transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 text-left hover:border-primary/60",
                !selectedBirthDate && "text-muted-foreground",
                errors.birthDate && "border-destructive focus:border-destructive focus:ring-destructive/20"
              )}
            >
              <span className="truncate">
                {formatDisplayValue('birthDate') || getPlaceholder('birthDate')}
              </span>
            </button>
            {errors.birthDate && (
              <p className="font-inter text-sm text-destructive font-medium">{errors.birthDate.message}</p>
            )}
          </div>

          {/* Bouton Continuer */}
          <Button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="font-inter w-full h-14 text-lg font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl"
          >
            {isSubmitting ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                <span>Enregistrement...</span>
              </div>
            ) : (
              'Continuer'
            )}
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
        <div className="mt-8 p-4 bg-muted/30 rounded-xl border border-border/50">
          <p className="font-inter text-sm text-muted-foreground text-center leading-relaxed">
            Ces infos permettent d'estimer précisément{' '}
            <span className="font-medium text-foreground">distance</span>,{' '}
            <span className="font-medium text-foreground">temps</span> et{' '}
            <span className="font-medium text-foreground">calories</span>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletion;