import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ArrowRight } from 'lucide-react';

const SubscriptionSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Optionally verify the session with Stripe here
    console.log('Subscription success with session:', sessionId);
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center">
      <Card className="max-w-md mx-auto text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Abonnement activé !</CardTitle>
          <CardDescription>
            Merci pour votre confiance. Votre abonnement Fitpas est maintenant actif.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-sm text-muted-foreground">
            <p>Vous avez maintenant accès à :</p>
            <ul className="mt-2 space-y-1">
              <li>• Itinéraires illimités</li>
              <li>• Statistiques avancées</li>
              <li>• Planification personnalisée</li>
              <li>• Support prioritaire</li>
            </ul>
          </div>
          
          <div className="space-y-3">
            <Link to="/" className="block">
              <Button className="w-full">
                Commencer à marcher
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/subscription" className="block">
              <Button variant="outline" className="w-full">
                Gérer mon abonnement
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionSuccess;