import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { signInSchema, signUpSchema } from '@/lib/validations/auth';
import type { SignInData, SignUpData } from '@/lib/validations/auth';

const AuthPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  const { signUp, signIn, signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Show logout option for authenticated users
  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setValidationErrors({});

    try {
      if (isSignUp) {
        // Validate sign up data
        const signUpData: SignUpData = {
          firstName,
          lastName,
          email,
          password,
          confirmPassword: password // Using password as confirmPassword for this component
        };
        const signUpValidation = signUpSchema.safeParse(signUpData);
        
        if (!signUpValidation.success) {
          const errors: Record<string, string> = {};
          signUpValidation.error.errors.forEach((error) => {
            if (error.path[0]) {
              errors[error.path[0] as string] = error.message;
            }
          });
          setValidationErrors(errors);
          setLoading(false);
          return;
        }

        const result = await signUp(email, password, firstName, lastName);
        if (result.error) {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: result.error.message || 'Une erreur est survenue lors de la création du compte',
          });
        } else {
          toast({
            title: 'Succès',
            description: 'Compte créé avec succès',
          });
          navigate('/');
        }
      } else {
        // Validate sign in data
        const signInData: SignInData = { email, password };
        const signInValidation = signInSchema.safeParse(signInData);
        
        if (!signInValidation.success) {
          const errors: Record<string, string> = {};
          signInValidation.error.errors.forEach((error) => {
            if (error.path[0]) {
              errors[error.path[0] as string] = error.message;
            }
          });
          setValidationErrors(errors);
          setLoading(false);
          return;
        }

        const result = await signIn(email, password);
        if (result.error) {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: result.error.message || 'Une erreur est survenue lors de la connexion',
          });
        } else {
          toast({
            title: 'Succès',
            description: 'Connexion réussie',
          });
          navigate('/');
        }
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Une erreur inattendue est survenue',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <div className="bg-card shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Retour</span>
          </button>
          
          <div className="flex items-center space-x-3">
            <img 
              src="/lovable-uploads/5216fdd6-d0d7-446b-9260-86d15d06f4ba.png" 
              alt="Fitpas" 
              className="h-8 w-auto"
              style={{ 
                filter: 'invert(0) sepia(1) saturate(5) hue-rotate(120deg) brightness(0.8)',
                color: '#10b981' 
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center p-6 pt-20">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              {isSignUp ? 'Créer un compte' : 'Se connecter'}
            </CardTitle>
            <CardDescription>
              {isSignUp 
                ? 'Créez votre compte Fitpas pour commencer' 
                : 'Connectez-vous à votre compte Fitpas'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Input
                      type="text"
                      placeholder="Prénom"
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        if (validationErrors.firstName) {
                          setValidationErrors(prev => ({ ...prev, firstName: '' }));
                        }
                      }}
                      required
                      className={validationErrors.firstName ? 'border-destructive' : ''}
                    />
                    {validationErrors.firstName && (
                      <p className="text-sm text-destructive mt-1">{validationErrors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <Input
                      type="text"
                      placeholder="Nom"
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        if (validationErrors.lastName) {
                          setValidationErrors(prev => ({ ...prev, lastName: '' }));
                        }
                      }}
                      required
                      className={validationErrors.lastName ? 'border-destructive' : ''}
                    />
                    {validationErrors.lastName && (
                      <p className="text-sm text-destructive mt-1">{validationErrors.lastName}</p>
                    )}
                  </div>
                </div>
              )}
              
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (validationErrors.email) {
                      setValidationErrors(prev => ({ ...prev, email: '' }));
                    }
                  }}
                  required
                  className={validationErrors.email ? 'border-destructive' : ''}
                />
                {validationErrors.email && (
                  <p className="text-sm text-destructive mt-1">{validationErrors.email}</p>
                )}
              </div>
              
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (validationErrors.password) {
                      setValidationErrors(prev => ({ ...prev, password: '' }));
                    }
                  }}
                  required
                  className={validationErrors.password ? 'border-destructive' : ''}
                />
                {validationErrors.password && (
                  <p className="text-sm text-destructive mt-1">{validationErrors.password}</p>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? 'Chargement...' : (isSignUp ? 'Créer le compte' : 'Se connecter')}
              </Button>
            </form>
            
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-primary hover:underline"
              >
                {isSignUp 
                  ? 'Déjà un compte ? Se connecter' 
                  : 'Pas de compte ? Créer un compte'
                }
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;