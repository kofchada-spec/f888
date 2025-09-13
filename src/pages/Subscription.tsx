import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, Crown, Sparkles, Clock, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier?: string;
  subscription_end?: string;
  hasAccess: boolean;
  inFreeTrial: boolean;
  trialEnd?: string;
}

const Subscription = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, [user]);

  const checkSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      setSubscriptionData(data);
    } catch (error) {
      console.error('Error checking subscription:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de vérifier votre abonnement',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan: 'monthly' | 'yearly') => {
    if (!user) return;

    setCheckoutLoading(plan);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan }
      });

      if (error) throw error;

      // Open Stripe checkout in a new tab
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de démarrer le processus de paiement',
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;

      // Open Stripe customer portal in a new tab
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible d\'ouvrir le portail de gestion',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysLeft = (dateString: string) => {
    const endDate = new Date(dateString);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-end mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-full w-10 h-10 p-0 hover:bg-muted/80 transition-all duration-200 hover:scale-110 group"
            onClick={() => navigate('/?dashboard=true')}
          >
            <X className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
          </Button>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Choisissez votre abonnement</h1>
            <p className="text-xl text-muted-foreground">
              Accédez à tous les itinéraires et fonctionnalités premium de FitPaS
            </p>
          </div>

          {/* Current Status */}
          {subscriptionData && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Statut actuel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    {subscriptionData.subscribed ? (
                      <div className="space-y-2">
                        <Badge variant="default" className="bg-green-500">
                          <Crown className="h-3 w-3 mr-1" />
                          Abonné {subscriptionData.subscription_tier}
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                          Renouvellement le {subscriptionData.subscription_end && formatDate(subscriptionData.subscription_end)}
                        </p>
                      </div>
                    ) : subscriptionData.inFreeTrial ? (
                      <div className="space-y-2">
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          Essai gratuit
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                          {subscriptionData.trialEnd && getDaysLeft(subscriptionData.trialEnd)} jours restants
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Badge variant="outline">Période d'essai expirée</Badge>
                        <p className="text-sm text-muted-foreground">
                          Abonnez-vous pour continuer à utiliser FitPaS
                        </p>
                      </div>
                    )}
                  </div>
                  {subscriptionData.subscribed && (
                    <Button onClick={handleManageSubscription} variant="outline">
                      Gérer mon abonnement
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pricing Plans */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Monthly Plan */}
            <Card className="relative">
              <CardHeader>
                <CardTitle className="text-2xl">Mensuel</CardTitle>
                <CardDescription>Parfait pour commencer</CardDescription>
                <div className="text-3xl font-bold">
                  9,99€<span className="text-lg font-normal text-muted-foreground">/mois</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Itinéraires illimités
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Statistiques avancées
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Planification personnalisée
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Support prioritaire
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={() => handleSubscribe('monthly')}
                  disabled={!!checkoutLoading}
                >
                  {checkoutLoading === 'monthly' ? 'Chargement...' : 'Choisir Mensuel'}
                </Button>
              </CardFooter>
            </Card>

            {/* Yearly Plan */}
            <Card className="relative border-primary">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">
                  33% de remise
                </Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  Annuel
                  <Crown className="h-5 w-5 text-yellow-500" />
                </CardTitle>
                <CardDescription>Le meilleur rapport qualité-prix</CardDescription>
                <div className="text-3xl font-bold">
                  79,99€<span className="text-lg font-normal text-muted-foreground">/an</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Soit 6,67€/mois (au lieu de 119,88€/an)
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Itinéraires illimités
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Statistiques avancées
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Planification personnalisée
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Support prioritaire
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="font-medium text-primary">2 mois gratuits</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={() => handleSubscribe('yearly')}
                  disabled={!!checkoutLoading}
                >
                  {checkoutLoading === 'yearly' ? 'Chargement...' : 'Choisir Annuel'}
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Features list */}
          <Card>
            <CardHeader>
              <CardTitle>Toutes les fonctionnalités incluses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Itinéraires personnalisés</h4>
                  <p className="text-sm text-muted-foreground">
                    Créez des parcours adaptés à vos objectifs et contraintes
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Statistiques détaillées</h4>
                  <p className="text-sm text-muted-foreground">
                    Suivez vos progrès avec des métriques avancées
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Planification intelligente</h4>
                  <p className="text-sm text-muted-foreground">
                    Organisez votre semaine d'entraînement automatiquement
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Support dédié</h4>
                  <p className="text-sm text-muted-foreground">
                    Une équipe à votre écoute pour vous accompagner
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Subscription;