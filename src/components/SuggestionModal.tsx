import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';

const suggestionSchema = z.object({
  title: z.string()
    .trim()
    .min(3, { message: "Le titre doit contenir au moins 3 caractères" })
    .max(100, { message: "Le titre ne peut pas dépasser 100 caractères" }),
  description: z.string()
    .trim()
    .min(10, { message: "La description doit contenir au moins 10 caractères" })
    .max(1000, { message: "La description ne peut pas dépasser 1000 caractères" }),
  category: z.string().optional(),
});

interface SuggestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SuggestionModal = ({ open, onOpenChange }: SuggestionModalProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const result = suggestionSchema.safeParse({
      title,
      description,
      category: category || undefined,
    });

    if (!result.success) {
      const fieldErrors: { title?: string; description?: string } = {};
      result.error.errors.forEach((error) => {
        const field = error.path[0] as 'title' | 'description';
        fieldErrors[field] = error.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Vous devez être connecté pour envoyer une suggestion");
        return;
      }

      const { error } = await supabase
        .from('suggestions')
        .insert({
          user_id: user.id,
          title: result.data.title,
          description: result.data.description,
          category: result.data.category || null,
        });

      if (error) throw error;

      toast.success("Merci pour votre suggestion ! Nous l'examinerons attentivement.");
      
      // Reset form
      setTitle('');
      setDescription('');
      setCategory('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      toast.error("Erreur lors de l'envoi de la suggestion");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Suggérer une idée</DialogTitle>
          <DialogDescription>
            Partagez vos idées pour améliorer FitPas. Nous lisons chaque suggestion !
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="category">Catégorie (optionnel)</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="feature">Nouvelle fonctionnalité</SelectItem>
                <SelectItem value="improvement">Amélioration</SelectItem>
                <SelectItem value="bug">Problème technique</SelectItem>
                <SelectItem value="other">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              placeholder="Ex: Ajouter un mode nuit"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className={errors.title ? 'border-destructive' : ''}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Décrivez votre idée en détail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={1000}
              className={errors.description ? 'border-destructive' : ''}
            />
            <div className="flex justify-between items-center">
              {errors.description ? (
                <p className="text-sm text-destructive">{errors.description}</p>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {description.length}/1000 caractères
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Envoi...' : 'Envoyer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
