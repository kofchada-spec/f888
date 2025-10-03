import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/hooks/useAuth';
import { User, Scale, Ruler, Calendar } from 'lucide-react';

interface ProfileCompletionProps {
  onComplete: () => void;
}

const profileSchema = z.object({
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  gender: z.string().min(1, "Veuillez sélectionner votre genre"),
  customGender: z.string().optional(),
  height: z.number()
    .min(1.0, "Entrez une taille entre 1,00 et 2,30 m")
    .max(2.3, "Entrez une taille entre 1,00 et 2,30 m"),
  weight: z.number()
    .min(30, "Entrez un poids entre 30 et 250 kg")
    .max(250, "Entrez un poids entre 30 et 250 kg"),
  day: z.number().min(1).max(31),
  month: z.number().min(1).max(12),
  year: z.number().min(1950).max(new Date().getFullYear() - 13)
}).refine((data) => {
  // Si "autre" est sélectionné, customGender doit être rempli
  if (data.gender === "autre" && (!data.customGender || data.customGender.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Veuillez préciser votre genre",
  path: ["customGender"]
});

type ProfileFormData = z.infer<typeof profileSchema>;

const ProfileCompletion = ({ onComplete }: ProfileCompletionProps) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      gender: '',
      customGender: '',
      height: 1.7,
      weight: 70,
      day: 15,
      month: 6,
      year: 1990
    }
  });

  const watchedGender = form.watch('gender');

  const onSubmit = async (data: ProfileFormData) => {
    setIsSubmitting(true);
    
    try {
      // Create birth date from day, month, year
      const birthDate = new Date(data.year, data.month - 1, data.day);
      
      // Calculate age
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const finalAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;

      // Déterminer la valeur finale du genre
      const finalGender = data.gender === "autre" && data.customGender 
        ? data.customGender.trim() 
        : data.gender;

      if (user) {
        // Save to Supabase profiles table if user is authenticated
        const { supabase } = await import('@/integrations/supabase/client');
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            first_name: data.firstName,
            gender: finalGender,
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
          first_name: data.firstName,
          gender: finalGender,
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

  // Generate day options
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month, 0).getDate();
  };

  const watchedMonth = form.watch('month');
  const watchedYear = form.watch('year');
  const maxDay = getDaysInMonth(watchedMonth, watchedYear);

  // Months array
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-3xl shadow-2xl p-8 border border-border/50">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Complétez votre profil</h1>
          <p className="text-muted-foreground text-sm">
            Renseignez vos informations pour une expérience personnalisée
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Prénom */}
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Prénom
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Entrez votre prénom" 
                      {...field} 
                      className="bg-background"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Genre */}
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Genre
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez votre genre" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="homme">Homme</SelectItem>
                      <SelectItem value="femme">Femme</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Champ personnalisé pour "Autre" */}
            {watchedGender === "autre" && (
              <FormField
                control={form.control}
                name="customGender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Précisez votre genre
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Entrez votre genre" 
                        {...field} 
                        className="bg-background"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Taille */}
            <FormField
              control={form.control}
              name="height"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Ruler className="w-4 h-4" />
                    Taille : {field.value.toFixed(2)}m
                  </FormLabel>
                  <FormControl>
                    <div className="px-3">
                      <Slider
                        min={1.0}
                        max={2.3}
                        step={0.01}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>1.00m</span>
                        <span>2.30m</span>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Poids */}
            <FormField
              control={form.control}
              name="weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Scale className="w-4 h-4" />
                    Poids : {field.value}kg
                  </FormLabel>
                  <FormControl>
                    <div className="px-3">
                      <Slider
                        min={30}
                        max={250}
                        step={1}
                        value={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>30kg</span>
                        <span>250kg</span>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date de naissance */}
            <div className="space-y-4">
              <FormLabel className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Date de naissance
              </FormLabel>
              
              <div className="grid grid-cols-3 gap-3">
                {/* Jour */}
                <FormField
                  control={form.control}
                  name="day"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Jour" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {Array.from({ length: maxDay }, (_, i) => i + 1).map((day) => (
                            <SelectItem key={day} value={day.toString()}>
                              {day.toString().padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Mois */}
                <FormField
                  control={form.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Mois" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {months.map((month, index) => (
                            <SelectItem key={index + 1} value={(index + 1).toString()}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Année */}
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Année" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {Array.from({ length: new Date().getFullYear() - 1950 - 13 + 1 }, (_, i) => new Date().getFullYear() - 13 - i).map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full mt-8" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enregistrement...' : 'Compléter mon profil'}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default ProfileCompletion;