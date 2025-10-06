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

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });
      
      if (error) {
        toast({
          variant: 'destructive',
          title: t('settings.toast.error'),
          description: error.message || 'Erreur de connexion avec Google',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('settings.toast.error'),
        description: 'Erreur de connexion avec Google',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });
      
      if (error) {
        toast({
          variant: 'destructive',
          title: t('settings.toast.error'),
          description: error.message || 'Erreur de connexion avec Apple',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('settings.toast.error'),
        description: 'Erreur de connexion avec Apple',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
    <div className="min-h-screen bg-background flex items-center justify-center p-6 relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleBackToOnboarding}
        className="absolute top-6 left-6"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {isResetMode ? 'Récupérer le mot de passe' : isLogin ? 'Se connecter' : 'Créer un compte'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Social Login Buttons - Hidden in reset mode */}
          {!isResetMode && (
          <div className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full py-6 text-lg"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              type="button"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuer avec Google
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full py-6 text-lg"
              onClick={handleAppleSignIn}
              disabled={isSubmitting}
              type="button"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="currentColor" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Continuer avec Apple
            </Button>
          </div>
          )}

          {!isResetMode && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Ou
              </span>
            </div>
          </div>
          )}

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