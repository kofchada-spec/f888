import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, MapPin, Clock, Zap, Loader2, RefreshCw } from 'lucide-react';
import EnhancedMap from './EnhancedMap';
import { useSingleDestination } from '@/hooks/useSingleDestination';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface DestinationSelectionProps {
  onComplete: (destination: Destination) => void;
  onBack: () => void;
  onGoToDashboard: () => void;
  planningData: {
    steps: string;
    pace: 'slow' | 'moderate' | 'fast';
    tripType: 'one-way' | 'round-trip';
    height: string;
    weight: string;
  };
}

interface Destination {
  id: string;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  routeGeoJSON?: any;
  distanceKm: number;
  durationMin: number;
  calories: number;
}

const DestinationSelection = ({ onComplete, onBack, onGoToDashboard, planningData }: DestinationSelectionProps) => {
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  // Référence supprimée car EnhancedMap gère sa propre logique
  const { user } = useAuth();
  const { subscriptionData } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    currentDestination, 
    refreshRemaining, 
    loading, 
    error, 
    fetchDestinations, 
    refreshDestination, 
    resetSession,
    canRefresh 
  } = useSingleDestination();

  // Réinitialiser la session si les paramètres changent
  useEffect(() => {
    resetSession();
  }, [planningData.steps, planningData.pace, planningData.tripType, planningData.height, planningData.weight, resetSession]);

  // Obtenir la localisation de l'utilisateur
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Geolocation error:', error);
          // Position par défaut (Paris)
          setUserLocation({ lat: 48.8566, lng: 2.3522 });
        }
      );
    } else {
      // Position par défaut si géolocalisation non supportée
      setUserLocation({ lat: 48.8566, lng: 2.3522 });
    }
  }, []);

  // DÉSACTIVÉ: Pas d'appel API automatique au chargement
  // Pour un état neutre, l'utilisateur devra déclencher manuellement la recherche

  const handleRefresh = () => {
    if (canRefresh) {
      refreshDestination();
    }
  };

  const handleStartWalk = () => {
    if (!currentDestination) return;
    
    // Lancer le suivi de marche pour tous les utilisateurs
    onComplete(currentDestination);
  };

  const handleDestinationClick = () => {
    // EnhancedMap gère automatiquement le centrage sur l'itinéraire
    console.log('Destination clicked - handled by EnhancedMap');
  };

  // Calculer l'écart avec la distance cible
  const getTargetDistance = () => {
    const steps = parseInt(planningData.steps);
    const heightM = parseFloat(planningData.height);
    const strideM = 0.415 * heightM;
    const totalKm = (steps * strideM) / 1000;
    // Return full target distance - route calculation handles round-trip logic internally
    return totalKm;
  };

  const getDeviation = () => {
    if (!currentDestination) return '0 km';
    const target = getTargetDistance();
    const deviation = currentDestination.distanceKm - target;
    const sign = deviation >= 0 ? '+' : '';
    return `${sign}${deviation.toFixed(1)} km`;
  };

  const getDeviationColor = () => {
    if (!currentDestination) return 'bg-gray-400';
    const target = getTargetDistance();
    const deviation = Math.abs(currentDestination.distanceKm - target);
    if (deviation <= 0.2) return 'bg-green-500';
    if (deviation <= 0.5) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <div className="bg-card shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center space-x-2 text-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft size={20} />
            <span>Retour</span>
          </button>
          
          <div className="flex items-center space-x-3 cursor-pointer" onClick={onGoToDashboard}>
            <img 
              src="/lovable-uploads/5216fdd6-d0d7-446b-9260-86d15d06f4ba.png" 
              alt="Fitpas" 
              className="h-8 w-auto hover:scale-105 transition-transform"
              style={{ 
                filter: 'invert(0) sepia(1) saturate(5) hue-rotate(120deg) brightness(0.8)',
                color: '#10b981' 
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-4xl mx-auto px-6 py-8">
        {/* Titre et description */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Choisis ta destination
          </h1>
          <div className="space-y-2 text-muted-foreground max-w-2xl mx-auto">
            <p>Fitpas calcule la distance en fonction de ton allure et du nombre de pas.</p>
            <p>Voici une destination proposée pour atteindre ton objectif.</p>
          </div>
        </div>

        {/* Résumé de la planification */}
        <div className="bg-card rounded-xl p-4 mb-8 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div className="text-center">
              <p className="text-muted-foreground">Objectif</p>
              <p className="font-semibold">{planningData.steps} pas</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Taille</p>
              <p className="font-semibold">{planningData.height} m</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Poids</p>
              <p className="font-semibold">{planningData.weight} kg</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Allure</p>
              <p className="font-semibold capitalize">
                {planningData.pace === 'slow' ? 'Lente' : 
                 planningData.pace === 'moderate' ? 'Modérée' : 'Rapide'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Type</p>
              <p className="font-semibold">
                {planningData.tripType === 'one-way' ? 'Aller' : 'A-R'}
              </p>
            </div>
          </div>
        </div>

        {/* Section Destination avec bouton Réactualiser séparé */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-foreground">Destination proposée</h2>
            {currentDestination && (
              <Button
                onClick={handleRefresh}
                disabled={!canRefresh || loading}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
                title={canRefresh ? `Réactualiser (${refreshRemaining} restant${refreshRemaining > 1 ? 's' : ''})` : 'Limite atteinte'}
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                <span>
                  {canRefresh ? `Réactualiser (${refreshRemaining})` : 'Limite atteinte'}
                </span>
              </Button>
            )}
          </div>

        {/* Instructions pour l'utilisateur */}
        <div className="bg-card rounded-xl p-6 mb-6 shadow-sm border">
          <div className="text-center">
            <MapPin className="h-8 w-8 mx-auto mb-3 text-primary" />
            <h3 className="text-lg font-medium text-foreground mb-2">Prêt à planifier votre marche ?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Cliquez sur le bouton ci-dessous pour rechercher une destination adaptée à votre objectif de {planningData.steps} pas.
            </p>
            <Button 
              onClick={() => userLocation && fetchDestinations(userLocation, planningData, { heightM: parseFloat(planningData.height), weightKg: parseFloat(planningData.weight) })}
              disabled={loading || !userLocation}
              className="bg-primary hover:bg-primary/90"
              size="default"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recherche en cours...
                </>
              ) : (
                'Rechercher ma destination'
              )}
            </Button>
          </div>
        </div>

        {/* Carte Mapbox avec itinéraires */}
        <div className="bg-card rounded-2xl shadow-lg overflow-hidden mb-4" style={{ height: '400px' }}>
          <EnhancedMap
            planningData={planningData}
            className="w-full h-full rounded-2xl"
            onRouteCalculated={(routeData) => {
              console.log('Route calculée:', routeData);
              // Traiter l'itinéraire calculé
              if (routeData && routeData.steps) {
                const targetSteps = parseInt(planningData.steps);
                const deviation = ((routeData.steps - targetSteps) / targetSteps) * 100;
                
                if (Math.abs(deviation) <= 5) {
                  toast({
                    title: "Itinéraire validé",
                    description: `${routeData.steps} pas (écart: ${deviation.toFixed(1)}%)`,
                  });
                }
              }
            }}
          />
        </div>

        {/* Instructions de navigation - Zone compacte sous la carte */}
        <div className="bg-muted/5 rounded-lg p-3 text-xs text-muted-foreground border max-h-32 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Instructions de navigation</h4>
            <span className="text-xs opacity-60">Itinéraire en cours...</span>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-start space-x-2 text-xs">
              <span className="w-4 h-4 bg-green-500/20 text-green-700 rounded-full flex items-center justify-center text-[10px] font-medium mt-0.5 flex-shrink-0">
                ▶
              </span>
              <span className="leading-relaxed">
                <strong>Aller:</strong> Polyligne verte (4px)
              </span>
            </div>
            {planningData.tripType === 'round-trip' && (
              <div className="flex items-start space-x-2 text-xs">
                <span className="w-4 h-4 bg-blue-500/20 text-blue-700 rounded-full flex items-center justify-center text-[10px] font-medium mt-0.5 flex-shrink-0">
                  ◀
                </span>
                <span className="leading-relaxed">
                  <strong>Retour:</strong> Polyligne bleue (4px, chemin différent)
                </span>
              </div>
            )}
            <div className="ml-6 text-[11px] space-y-0.5 pt-1 border-t border-muted/20">
              <div>📍 Objectif: {planningData.steps} pas (±5% tolérance)</div>
              <div>⚡ Mode: {planningData.pace === 'slow' ? 'Lent' : planningData.pace === 'moderate' ? 'Modéré' : 'Rapide'}</div>
              <div>🎯 Type: {planningData.tripType === 'round-trip' ? 'Aller-retour' : 'Aller simple'}</div>
            </div>
          </div>
        </div>
        </div>

        {/* Carte-info de destination (clickable) - Masquée en état neutre */}
        {false && currentDestination && (
          <Card 
            className="p-6 mb-8 shadow-lg cursor-pointer hover:shadow-xl transition-shadow duration-200 border-2 hover:border-primary/20"
            onClick={handleDestinationClick}
          >
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground">
                🎯
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-semibold text-foreground mb-2">
                  {currentDestination.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Cliquez sur cette carte pour centrer la vue sur l'itinéraire
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <MapPin size={16} className="text-primary" />
                    <div>
                      <span className="font-medium">{currentDestination.distanceKm.toFixed(1)} km</span>
                      <p className="text-xs text-muted-foreground">Distance aller</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock size={16} className="text-secondary" />
                    <div>
                      <span className="font-medium">{currentDestination.durationMin} min</span>
                      <p className="text-xs text-muted-foreground">Durée aller</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Zap size={16} className="text-orange-500" />
                    <div>
                      <span className="font-medium">{currentDestination.calories} cal</span>
                      <p className="text-xs text-muted-foreground">Calories totales</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-4 h-4 rounded-full ${getDeviationColor()}`}></div>
                    <div>
                      <span className="font-medium">{getDeviation()}</span>
                      <p className="text-xs text-muted-foreground">Écart cible</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Bouton CTA - Masqué en état neutre */}
        {currentDestination && (
          <div className="text-center">
            <Button
              onClick={handleStartWalk}
              disabled={!currentDestination}
              size="lg"
              className="w-full max-w-md h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none"
            >
              Lancer cette marche
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DestinationSelection;