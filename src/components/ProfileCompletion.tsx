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

  const handleProfileComplete = async (data: ProfileData) => {
    setIsSubmitting(true);
    
    try {
      // Calculate age
      const today = new Date();
      const birthDate = data.birthDate;
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const finalAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;

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
        <p className="text-center text-foreground">
          Profil en cours d'implémentation avec des gestes de slide...
        </p>
        <Button onClick={onComplete} className="w-full mt-4">
          Continuer pour l'instant
        </Button>
      </div>
    </div>
  );
};

export default ProfileCompletion;