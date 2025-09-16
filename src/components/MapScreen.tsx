import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import OptimizedMap from './OptimizedMap';
import { useSingleDestination } from '@/hooks/useSingleDestination';

interface MapScreenProps {
  onComplete: (destination: any) => void;
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

const MapScreen = ({ onComplete, onBack, onGoToDashboard, planningData }: MapScreenProps) => {
  const [isReadyToStart, setIsReadyToStart] = useState(false);
  const [routeData, setRouteData] = useState<{
    distance: number;
    duration: number;
    calories: number;
    steps: number;
    startCoordinates: { lat: number; lng: number };
    endCoordinates: { lat: number; lng: number };
    routeGeoJSON?: any;
  } | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  const { currentDestination, loading, fetchDestinations } = useSingleDestination();

  // Get user location and fetch destinations on mount  
  React.useEffect(() => {
    const getUserLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setUserLocation(location);
            
            // Fetch optimized destinations
            try {
              await fetchDestinations(location, planningData);
            } catch (error) {
              console.error('Failed to fetch destinations:', error);
            }
          },
          (error) => {
            console.error('Geolocation error:', error);
            // Default to Paris if geolocation fails
            setUserLocation({ lat: 48.8566, lng: 2.3522 });
          }
        );
      }
    };
    getUserLocation();
  }, [fetchDestinations, planningData]);

  const handleRouteCalculated = useCallback((data: {
    distance: number;
    duration: number;
    calories: number;
    steps: number;
    startCoordinates: { lat: number; lng: number };
    endCoordinates: { lat: number; lng: number };
    routeGeoJSON?: any;
  }) => {
    console.log('🎯 Route calculated:', data);
    setRouteData(data);
    setIsReadyToStart(true);
  }, []);

  const handleStartWalk = useCallback(() => {
    if (!routeData && !currentDestination) return;
    
    // Prioritize currentDestination from optimized routing, fallback to routeData
    const destination = currentDestination ? {
      id: currentDestination.id,
      name: currentDestination.name,
      coordinates: currentDestination.coordinates,
      distanceKm: currentDestination.distanceKm,
      durationMin: currentDestination.durationMin,
      calories: currentDestination.calories,
      routeGeoJSON: currentDestination.routeGeoJSON
    } : {
      id: 'map-selected-destination',
      name: 'Destination sélectionnée',
      coordinates: routeData!.endCoordinates,
      distanceKm: routeData!.distance,
      durationMin: routeData!.duration,
      calories: routeData!.calories,
      routeGeoJSON: routeData!.routeGeoJSON
    };
    
    onComplete(destination);
  }, [routeData, currentDestination, onComplete]);

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
              alt="FitPaS" 
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
      <div className="container max-w-6xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Planifiez votre marche
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Tapez sur la carte pour placer votre destination. Un itinéraire sera calculé automatiquement.
          </p>
        </div>

        {/* Planning Summary */}
        <div className="bg-card rounded-xl p-4 mb-6 shadow-sm">
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

        {/* Optimized Map */}
        <div className="mb-6">
          {userLocation && (
            <OptimizedMap 
              userLocation={userLocation}
              destinations={currentDestination ? [{
                id: currentDestination.id,
                name: currentDestination.name,
                distance: `${currentDestination.distanceKm} km`,
                duration: `${currentDestination.durationMin} min`,
                calories: currentDestination.calories,
                description: 'Generated optimized destination',
                coordinates: currentDestination.coordinates,
                route: currentDestination.routeGeoJSON
              }] : []}
              selectedDestination={currentDestination?.id}
              planningData={planningData}
              onDestinationSelect={(id) => {
                console.log('🎯 Destination selected:', id);
                if (currentDestination) {
                  handleRouteCalculated({
                    distance: currentDestination.distanceKm,
                    duration: currentDestination.durationMin,
                    calories: currentDestination.calories,
                    steps: parseInt(planningData.steps),
                    startCoordinates: userLocation,
                    endCoordinates: currentDestination.coordinates,
                    routeGeoJSON: currentDestination.routeGeoJSON
                  });
                }
              }}
            />
          )}
          
          {!userLocation && (
            <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-muted-foreground">Getting your location...</p>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="text-center">
          <Button
            onClick={handleStartWalk}
            disabled={!isReadyToStart && !currentDestination}
            size="lg"
            className="w-full max-w-md h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-50"
          >
            {loading ? 'Loading optimal route...' :
             currentDestination ? 'Start Walk' :
             !isReadyToStart ? 'Calculating route...' : 'Start Walk'}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            {currentDestination ? 'Optimized route ready for tracking' : 'Route will be saved and GPS tracking will begin'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MapScreen;