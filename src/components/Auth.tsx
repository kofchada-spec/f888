import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface AuthProps {
  onComplete: () => void;
}

const Auth = ({ onComplete }: AuthProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { signIn, signUp, resetPassword, user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Redirect authenticated users
  useEffect(() => {
    if (user) {
      onComplete();
    }
  }, [user, onComplete]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isResetMode) {
        const { error } = await resetPassword(email);
        if (error) {
          toast({
            variant: 'destructive',
            title: t('auth.errors.resetError'),
            description: error.message || t('auth.errors.resetError'),
          });
        } else {
          toast({
            title: t('auth.success.emailSent'),
            description: t('auth.success.emailSentDesc'),
          });
          setIsResetMode(false);
          setIsLogin(true);
        }
      } else if (!isLogin) {
        if (password !== confirmPassword) {
          toast({
            variant: 'destructive',
            title: t('settings.toast.error'),
            description: t('auth.errors.passwordMismatch'),
          });
          return;
        }
        
        const { error } = await signUp(email, password);
        if (error) {
          toast({
            variant: 'destructive',
            title: t('settings.toast.error'),
            description: error.message || t('auth.errors.signUpError'),
          });
        } else {
          toast({
            title: t('auth.success.accountCreated'),
            description: t('auth.success.accountCreatedDesc'),
          });
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            variant: 'destructive',
            title: t('settings.toast.error'),
            description: error.message || t('auth.errors.signInError'),
          });
        }
        // User will be redirected automatically via useEffect if successful
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToOnboarding = () => {
    localStorage.removeItem('fitpas-onboarding-complete');
    localStorage.removeItem('fitpas-profile-complete');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleBackToOnboarding}
        className="absolute top-6 left-6"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <Card className="w-full max-w-sm md:max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {isResetMode ? 'Récupérer le mot de passe' : isLogin ? 'Se connecter' : 'Créer un compte'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Manual Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                required
              />
            </div>
            
            {!isResetMode && (
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            )}

            {!isLogin && !isResetMode && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            <Button 
              type="submit"
              variant="default"
              disabled={isSubmitting}
              className="w-full py-6 text-lg bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isResetMode ? 'Envoi...' : isLogin ? 'Connexion...' : 'Création...'}
                </>
              ) : (
                isResetMode ? 'Envoyer le lien de récupération' : isLogin ? 'Se connecter' : 'Créer un compte'
              )}
            </Button>
          </form>

          <div className="text-center space-y-2">
            {!isResetMode && (
              <>
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-secondary hover:underline block"
                >
                  {isLogin 
                    ? "Pas encore de compte ? Créer un compte" 
                    : "Déjà un compte ? Se connecter"
                  }
                </button>
                
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setIsResetMode(true)}
                    className="text-sm text-muted-foreground hover:underline block"
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </>
            )}
            
            {isResetMode && (
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(false);
                  setIsLogin(true);
                }}
                className="text-sm text-secondary hover:underline"
              >
                Retour à la connexion
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;