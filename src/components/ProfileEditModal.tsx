import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2 } from 'lucide-react';
import avatar1 from '@/assets/avatars/avatar-1.png';
import avatar2 from '@/assets/avatars/avatar-2.png';
import avatar3 from '@/assets/avatars/avatar-3.png';
import avatar4 from '@/assets/avatars/avatar-4.png';
import avatar5 from '@/assets/avatars/avatar-5.png';
import avatar6 from '@/assets/avatars/avatar-6.png';
import avatar7 from '@/assets/avatars/avatar-7.png';
import avatar8 from '@/assets/avatars/avatar-8.png';
import avatar9 from '@/assets/avatars/avatar-9.png';
import avatar10 from '@/assets/avatars/avatar-10.png';

const avatarOptions = [
  { id: 'avatar-1', src: avatar1, alt: 'Avatar 1' },
  { id: 'avatar-2', src: avatar2, alt: 'Avatar 2' },
  { id: 'avatar-3', src: avatar3, alt: 'Avatar 3' },
  { id: 'avatar-4', src: avatar4, alt: 'Avatar 4' },
  { id: 'avatar-5', src: avatar5, alt: 'Avatar 5' },
  { id: 'avatar-6', src: avatar6, alt: 'Avatar 6' },
  { id: 'avatar-7', src: avatar7, alt: 'Femme noire' },
  { id: 'avatar-8', src: avatar8, alt: 'Enfant noir' },
  { id: 'avatar-9', src: avatar9, alt: 'Homme noir' },
  { id: 'avatar-10', src: avatar10, alt: 'Personne âgée noire' },
];

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: {
    weight: number;
    age: number;
    gender: string;
    height: number;
    avatar: string | null;
  };
  onProfileUpdate: (updatedProfile: { weight: number; age: number; avatar: string | null }) => void;
}

export const ProfileEditModal = ({ 
  isOpen, 
  onClose, 
  currentProfile, 
  onProfileUpdate 
}: ProfileEditModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [weight, setWeight] = useState(currentProfile.weight || 70);
  const [age, setAge] = useState(currentProfile.age || 30);
  const [selectedAvatar, setSelectedAvatar] = useState(currentProfile.avatar || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validation du fichier
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        variant: "destructive",
        title: "Fichier trop volumineux",
        description: "La taille maximale autorisée est de 5MB.",
      });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Format non supporté",
        description: "Seuls les formats JPG, PNG et WEBP sont autorisés.",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Supprimer l'ancien avatar s'il existe
      if (selectedAvatar && selectedAvatar.includes('supabase')) {
        const oldPath = selectedAvatar.split('/').slice(-2).join('/');
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      // Upload du nouveau fichier
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path);

      setSelectedAvatar(publicUrl);
      
      toast({
        title: "Photo téléchargée",
        description: "Votre photo de profil a été téléchargée avec succès.",
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({
        variant: "destructive",
        title: "Erreur de téléchargement",
        description: "Impossible de télécharger la photo.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteCustomAvatar = async () => {
    if (!selectedAvatar || !selectedAvatar.includes('supabase') || !user) return;

    try {
      const path = selectedAvatar.split('/').slice(-2).join('/');
      await supabase.storage.from('avatars').remove([path]);
      setSelectedAvatar(null);
      
      toast({
        title: "Photo supprimée",
        description: "Votre photo personnelle a été supprimée.",
      });
    } catch (error) {
      console.error('Error deleting avatar:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer la photo.",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (weight < 20 || weight > 300) {
      toast({
        variant: "destructive",
        title: "Erreur de validation",
        description: "Le poids doit être entre 20 et 300 kg",
      });
      return;
    }
    
    if (age < 10 || age > 100) {
      toast({
        variant: "destructive", 
        title: "Erreur de validation",
        description: "L'âge doit être entre 10 et 100 ans",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (user) {
        // Save to Supabase
        const { error } = await supabase
          .from('profiles')
          .update({ 
            weight_kg: weight, 
            age_years: age,
            avatar_url: selectedAvatar
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Save to localStorage
        const localProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        localStorage.setItem('userProfile', JSON.stringify({
          ...localProfile,
          weight_kg: weight,
          age_years: age,
          avatar_url: selectedAvatar
        }));
      }

      onProfileUpdate({ weight, age, avatar: selectedAvatar });
      
      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été sauvegardées avec succès.",
      });
      
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de sauvegarder les modifications.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Modifier mes informations</DialogTitle>
          <DialogDescription>
            Modifiez votre poids, âge et avatar de profil.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section Avatar */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Choisir un avatar</Label>
            
            {/* Avatar personnalisé actuel */}
            {selectedAvatar && selectedAvatar.includes('supabase') && (
              <div className="mb-4 p-3 border border-muted rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <img 
                    src={selectedAvatar} 
                    alt="Avatar personnalisé"
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Photo personnelle</p>
                    <p className="text-xs text-muted-foreground">Votre photo actuelle</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteCustomAvatar}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            
            {/* Bouton de téléchargement */}
            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || !user}
                className="w-full mb-3"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? "Téléchargement..." : "Télécharger une photo"}
              </Button>
              {!user && (
                <p className="text-xs text-muted-foreground text-center">
                  Connectez-vous pour télécharger vos propres photos
                </p>
              )}
            </div>
            
            {/* Avatars prédéfinis */}
            <p className="text-xs text-muted-foreground mb-2">Ou choisissez un avatar prédéfini :</p>
            <div className="grid grid-cols-5 gap-3">
              {avatarOptions.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => setSelectedAvatar(avatar.src)}
                  className={`relative w-16 h-16 rounded-full overflow-hidden border-2 transition-all hover:scale-105 ${
                    selectedAvatar === avatar.src
                      ? 'border-primary shadow-lg ring-2 ring-primary/20'
                      : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <img 
                    src={avatar.src} 
                    alt={avatar.alt}
                    className="w-full h-full object-cover"
                  />
                  {selectedAvatar === avatar.src && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="w-3 h-3 bg-primary rounded-full"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="gender" className="text-muted-foreground">Genre</Label>
              <Input 
                id="gender"
                value={currentProfile.gender || '-'}
                disabled
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div>
              <Label htmlFor="height" className="text-muted-foreground">Taille</Label>
              <Input 
                id="height"
                value={currentProfile.height > 0 ? `${currentProfile.height}m` : '-'}
                disabled
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="weight">Poids (kg)</Label>
              <Input
                id="weight"
                type="number"
                min="20"
                max="300"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="border-input focus:border-primary"
                required
              />
            </div>
            <div>
              <Label htmlFor="age">Âge (années)</Label>
              <Input
                id="age"
                type="number"
                min="10"
                max="100"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="border-input focus:border-primary"
                required
              />
            </div>
          </div>
        </form>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};