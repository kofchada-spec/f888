import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PlanningData } from '@/types/route';

interface Destination {
  id: string;
  name: string;
  distance: string;
  duration: string;
  calories: number;
  description: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  route?: any;
  routeGeoJSON?: any; // Ajout pour compatibilité avec DestinationSelection
}

interface MapProps {
  userLocation: { lat: number; lng: number } | null;
  destinations: Destination[];
  selectedDestination: string | null;
  onDestinationSelect: (destination: Destination) => void;
  planningData: PlanningData;
  isTracking?: boolean; // Nouveau prop pour le mode suivi
}

export interface MapRef {
  fitToRoute: () => void;
}

const Map = forwardRef<MapRef, MapProps>(({ userLocation, destinations, selectedDestination, onDestinationSelect, planningData, isTracking = false }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const lastDestinationKey = useRef<string>(''); // Track destination changes to prevent flicker
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

  // Expose map methods via ref
  useImperativeHandle(ref, () => ({
    fitToRoute: () => {
      if (!map.current || !userLocation || destinations.length === 0) return;
      
      const currentDest = destinations[0];
      if (!currentDest.coordinates) return;

      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([userLocation.lng, userLocation.lat]);
      bounds.extend([currentDest.coordinates.lng, currentDest.coordinates.lat]);
      
      map.current.fitBounds(bounds, {
        padding: 80,
        duration: 1000,
        maxZoom: 15
      });
    }
  }));

  // Get Mapbox token from Supabase edge function (only once)
  useEffect(() => {
    const getMapboxToken = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('mapbox-token');
        
        if (error) {
          console.error('Error calling mapbox-token function:', error);
          throw error;
        }
        
        if (data?.token && typeof data.token === 'string' && data.token.startsWith('pk.')) {
          console.log('Valid Mapbox token received');
          setMapboxToken(data.token);
        } else {
          console.error('Invalid token received:', data);
          throw new Error('Invalid token received');
        }
      } catch (error) {
        console.error('Error fetching Mapbox token:', error);
        // Fallback: ask user to provide token directly in console for debugging
        console.log('Please check your MAPBOX_PUBLIC_TOKEN in Supabase secrets');
        setMapboxToken(null);
      }
    };
    getMapboxToken();
  }, []);

  // Initialize map once when token is available
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !mapboxToken.startsWith('pk.')) {
      console.log('Map initialization waiting for:', { 
        container: !!mapContainer.current, 
        token: !!mapboxToken,
        validToken: !!mapboxToken && mapboxToken.startsWith('pk.')
      });
      return;
    }

    // Prevent re-initialization if map already exists
    if (map.current) {
      console.log('Map already initialized, skipping');
      return;
    }

    console.log('Initializing map with token:', mapboxToken.substring(0, 20) + '...');
    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      zoom: 14,
      center: userLocation ? [userLocation.lng, userLocation.lat] : [2.3522, 48.8566], // Paris par défaut
    });

    // Add error handling
    map.current.on('error', (e) => {
      console.error('Mapbox error:', e.error);
      console.error('Error type:', e.error?.message);
      if (e.error?.message?.includes('401') || e.error?.message?.includes('403')) {
        console.error('Authentication error - check your Mapbox token');
      }
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    // Add geolocate control
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserLocation: true
      }),
      'top-right'
    );

    // Wait for map to load before adding POI interactions
    map.current.on('load', () => {
      // Resize map to ensure proper rendering
      setTimeout(() => {
        if (map.current) {
          map.current.resize();
        }
      }, 100);

      // Protéger les événements POI avec getLayer
      if (map.current?.getLayer('poi-label')) {
        map.current.on('click', 'poi-label', (e) => {
          const coordinates = e.lngLat;
          const properties = e.features![0].properties;
          
          new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
              <div class="p-2">
                <h3 class="font-semibold">${properties.name || 'Point d\'intérêt'}</h3>
                <p class="text-sm text-gray-600">${properties.class || 'Lieu'}</p>
              </div>
            `)
            .addTo(map.current!);
        });

        map.current.on('mouseenter', 'poi-label', () => {
          map.current!.getCanvas().style.cursor = 'pointer';
        });

        map.current.on('mouseleave', 'poi-label', () => {
          map.current!.getCanvas().style.cursor = '';
        });
      }
    });

    // Cleanup
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken]);

  // Update camera when userLocation changes (only once on initialization)
  useEffect(() => {
    if (map.current && userLocation && markers.current.length === 0) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 14,
        speed: 1.2,
        curve: 1.42
      });
    }
  }, [userLocation]);

  // Update user location marker and center camera in tracking mode
  useEffect(() => {
    if (!map.current || !userLocation) return;

    // Update only user location marker, keep routes stable
    const existingUserMarker = markers.current.find(marker => 
      marker.getElement().classList.contains('user-location-marker')
    );
    
    if (existingUserMarker) {
      existingUserMarker.setLngLat([userLocation.lng, userLocation.lat]);
      
      // En mode tracking, centrer la caméra sur la position de l'utilisateur
      if (isTracking) {
        map.current.easeTo({
          center: [userLocation.lng, userLocation.lat],
          duration: 1000,
          zoom: 16 // Zoom plus serré pour le suivi
        });
      }
      return;
    }
  }, [userLocation, isTracking]);

  // Initialize markers and routes ONLY when destinations actually change - prevent route flicker
  useEffect(() => {
    console.log('🔍 Map useEffect triggered:', {
      hasMap: !!map.current,
      hasUserLocation: !!userLocation,
      destinationsLength: destinations.length,
      destinations: destinations.map(d => ({ id: d.id, name: d.name, hasRoute: !!d.routeGeoJSON, hasCoordinates: !!d.coordinates }))
    });

    if (!map.current || !userLocation || destinations.length === 0) {
      console.log('❌ Early return from map useEffect:', { hasMap: !!map.current, hasUserLocation: !!userLocation, destinationsLength: destinations.length });
      return;
    }

    // Only update if destinations array actually changed, not user location updates
    const destinationKey = destinations.map(d => `${d.id}-${d.name}-${!!d.routeGeoJSON}`).join('|');
    
    if (lastDestinationKey.current === destinationKey) {
      console.log('⏸️ Destinations unchanged, keeping stable routes');
      return; // Skip re-render if destinations haven't actually changed
    }
    
    lastDestinationKey.current = destinationKey;
    console.log('🗺️ Rendering routes for destinations:', destinationKey);

    // Clear existing markers only when destinations actually change
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add user location marker (without label text)
    const userLocationEl = document.createElement('div');
    userLocationEl.className = 'user-location-marker';
    userLocationEl.innerHTML = `
      <div style="
        width: ${isTracking ? '32px' : '24px'};
        height: ${isTracking ? '32px' : '24px'};
        background: ${isTracking ? '#f97316' : '#ef4444'};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3), ${isTracking ? '0 0 0 10px rgba(249, 115, 22, 0.2)' : 'none'};
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isTracking ? '16px' : '12px'};
        animation: ${isTracking ? 'pulse 2s infinite' : 'none'};
      ">
        ${isTracking ? '🏃' : '📍'}
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { box-shadow: 0 2px 10px rgba(0,0,0,0.3), 0 0 0 10px rgba(249, 115, 22, 0.2); }
          50% { box-shadow: 0 2px 10px rgba(0,0,0,0.3), 0 0 0 20px rgba(249, 115, 22, 0); }
        }
      </style>
    `;

    const userMarker = new mapboxgl.Marker(userLocationEl)
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current);
    
    markers.current.push(userMarker);

    // Add destination markers (without label text)
    destinations.forEach((destination, index) => {
      console.log(`Processing destination ${index + 1}:`, {
        id: destination.id,
        name: destination.name,
        coordinates: destination.coordinates,
        hasRoute: !!destination.route
      });

      let destLng, destLat;
      
      // Use real coordinates if available, otherwise calculate position
      if (destination.coordinates && destination.coordinates.lat && destination.coordinates.lng) {
        destLng = destination.coordinates.lng;
        destLat = destination.coordinates.lat;
        console.log(`Using real coordinates for ${destination.name}:`, { lat: destLat, lng: destLng });
      } else {
        // Fallback to calculated positions around user location
        const angle = (index * 120) * (Math.PI / 180);
        const distance = 0.01; // ~1km en degrés approximatifs
        destLng = userLocation.lng + Math.cos(angle) * distance;
        destLat = userLocation.lat + Math.sin(angle) * distance;
        console.log(`Using calculated coordinates for ${destination.name}:`, { lat: destLat, lng: destLng });
      }

      // Variables needed for route rendering
      const isSelected = selectedDestination === destination.id;
      const isRoundTrip = planningData.tripType === 'round-trip';

      // Create destination marker without label
      const markerEl = document.createElement('div');
      markerEl.className = 'destination-marker';
      
      markerEl.innerHTML = `
        <div style="
          width: 40px;
          height: 40px;
          background: ${isSelected ? '#10b981' : '#6b7280'};
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          transform: ${isSelected ? 'scale(1.1)' : 'scale(1)'};
          font-size: 18px;
        ">
          🎯
        </div>
      `;

      markerEl.addEventListener('click', () => {
        onDestinationSelect(destination);
      });

      const marker = new mapboxgl.Marker(markerEl)
        .setLngLat([destLng, destLat])
        .addTo(map.current!);

      markers.current.push(marker);

      // Add route immediately - stable rendering for navigation screen
      const mapStyleLoaded = map.current?.isStyleLoaded();
      console.log(`🎯 Tentative ajout route pour ${destination.name}:`, {
        destinationId: destination.id,
        isStyleLoaded: mapStyleLoaded,
        hasRoute: !!destination.routeGeoJSON,
        isSelected,
        isRoundTrip,
        routeStructure: destination.routeGeoJSON ? {
          hasOutbound: !!destination.routeGeoJSON.outboundCoordinates,
          hasReturn: !!destination.routeGeoJSON.returnCoordinates,
          outboundLength: destination.routeGeoJSON.outboundCoordinates?.length,
          returnLength: destination.routeGeoJSON.returnCoordinates?.length
        } : 'no route'
      });

      if (mapStyleLoaded) {
        if (destination.routeGeoJSON) {
          console.log('✅ Style loaded - Adding preconfigured route immediately');
          addRouteFromGeometry(destination.id, destination.routeGeoJSON, isSelected);
        } else {
          console.log('✅ Style loaded - Adding simple route immediately');
          addRouteLine(destination.id, userLocation, { lat: destLat, lng: destLng }, isRoundTrip, isSelected);
        }
      } else {
        console.log('⏳ Style not loaded - Setting up deferred route rendering');
        map.current?.on('styledata', () => {
          if (map.current?.isStyleLoaded()) {
            console.log('🎯 Deferred route rendering triggered');
            if (destination.routeGeoJSON) {
              console.log('✅ Adding preconfigured route (deferred)');
              addRouteFromGeometry(destination.id, destination.routeGeoJSON, isSelected);
            } else {
              console.log('✅ Adding simple route (deferred)');
              addRouteLine(destination.id, userLocation, { lat: destLat, lng: destLng }, isRoundTrip, isSelected);
            }
          }
        });
      }
    });
  }, [destinations, selectedDestination]); // STABLE dependencies - no userLocation changes

  // IntersectionObserver to resize map when it becomes visible (must be before any returns)
  useEffect(() => {
    if (!mapContainer.current || !map.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && map.current) {
            setTimeout(() => {
              map.current?.resize();
            }, 100);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(mapContainer.current);

    return () => {
      observer.disconnect();
    };
  }, [map.current]);

  const addRouteFromGeometry = (
    destId: string,
    routeGeometry: any,
    isSelected: boolean
  ) => {
    if (!map.current) return;

    // Check if this is a round-trip route with separate outbound/return paths
    console.log('🗺️ addRouteFromGeometry appelée:', {
      destId,
      routeGeometry,
      hasOutbound: !!routeGeometry?.outboundCoordinates,
      hasReturn: !!routeGeometry?.returnCoordinates,
      isSelected,
      outboundLength: routeGeometry?.outboundCoordinates?.length,
      returnLength: routeGeometry?.returnCoordinates?.length
    });

    // Handle routes with outboundCoordinates (modern format)
    if (routeGeometry.outboundCoordinates) {
      const hasReturnRoute = !!routeGeometry.returnCoordinates;
      console.log(`✅ Affichage route ${hasReturnRoute ? 'aller-retour' : 'aller simple'} avec coordonnées`);
      
      // Remove existing routes
      const outboundLayerId = `outbound-route-${destId}`;
      const returnLayerId = `return-route-${destId}`;
      const outboundSourceId = `outbound-source-${destId}`;
      const returnSourceId = `return-source-${destId}`;

      [outboundLayerId, returnLayerId].forEach(layerId => {
        if (map.current?.getLayer(layerId)) {
          map.current.removeLayer(layerId);
        }
      });
      [outboundSourceId, returnSourceId].forEach(sourceId => {
        if (map.current?.getSource(sourceId)) {
          map.current.removeSource(sourceId);
        }
      });

      // TOUJOURS afficher les routes (même si pas officiellement "sélectionnée")
      const shouldDisplay = isSelected || destinations.length === 1;
      
      if (shouldDisplay) {
        console.log('🎯 Ajout de la route sur la carte');
        
        // Add outbound route (green solid)
        map.current.addSource(outboundSourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routeGeometry.outboundCoordinates
            }
          }
        });

        map.current.addLayer({
          id: outboundLayerId,
          type: 'line',
          source: outboundSourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#10b981', // Green - Aller
            'line-width': isTracking ? 6 : 4, // Plus épais en mode tracking
            'line-opacity': isTracking ? 0.9 : 0.7
          }
        });

        // Add return route only if it exists (blue dashed)
        if (hasReturnRoute) {
          map.current.addSource(returnSourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: routeGeometry.returnCoordinates
              }
            }
          });

          map.current.addLayer({
            id: returnLayerId,
            type: 'line',
            source: returnSourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3b82f6', // Blue - Retour
              'line-width': isTracking ? 6 : 4, // Plus épais en mode tracking
              'line-opacity': isTracking ? 0.9 : 0.8,
              'line-dasharray': [2, 3] // Ligne pointillée pour le retour
            }
          });
          
          console.log('✅ Routes aller-retour ajoutées avec succès');
        } else {
          console.log('✅ Route aller simple ajoutée avec succès');
        }
      } else {
        console.log('⏸️ Route non sélectionnée, pas d\'affichage');
      }
    } else {
      // Legacy single route format
      const sourceId = `route-${destId}`;
      const layerId = `route-layer-${destId}`;

      // Remove existing route if it exists
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }

      map.current.addSource(sourceId, {
        type: 'geojson',
        data: routeGeometry
      });

      map.current.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': isSelected ? '#10b981' : '#6b7280',
          'line-width': isSelected ? 4 : 2,
          'line-opacity': isSelected ? 1 : 0.6
        }
      });
    }
  };

  const addRouteLine = (
    destId: string, 
    start: { lat: number; lng: number }, 
    end: { lat: number; lng: number }, 
    isRoundTrip: boolean,
    isSelected: boolean
  ) => {
    if (!map.current) return;

    const sourceId = `route-${destId}`;
    const layerId = `route-layer-${destId}`;

    // Remove existing route if it exists
    if (map.current.getLayer(layerId)) {
      map.current.removeLayer(layerId);
    }
    if (map.current.getSource(sourceId)) {
      map.current.removeSource(sourceId);
    }

    let coordinates;
    if (isRoundTrip) {
      // Create a curved path that returns to start
      const midLng = (start.lng + end.lng) / 2;
      const midLat = (start.lat + end.lat) / 2;
      const offset = 0.005; // Create curve
      coordinates = [
        [start.lng, start.lat],
        [end.lng, end.lat],
        [midLng + offset, midLat + offset],
        [start.lng, start.lat]
      ];
    } else {
      // Simple straight line
      coordinates = [
        [start.lng, start.lat],
        [end.lng, end.lat]
      ];
    }

    map.current.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates
        }
      }
    });

    map.current.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': isSelected ? '#10b981' : '#6b7280', // STATIC colors, no animation
        'line-width': isSelected ? 4 : 2,
        'line-opacity': isSelected ? 1 : 0.6
      }
    });
  };

  if (!mapboxToken || !mapboxToken.startsWith('pk.')) {
    return (
      <div style={{ height: '360px' }} className="relative bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground mb-2">
            {!mapboxToken ? 'Chargement du token Mapbox...' : 'Token Mapbox invalide'}
          </p>
          <p className="text-xs text-muted-foreground">
            Vérifiez que votre token Mapbox est configuré dans les secrets Supabase.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '360px' }} className="relative rounded-2xl overflow-hidden shadow-lg">
      <div 
        ref={mapContainer} 
        style={{ width: '100%', height: '100%' }}
        className="absolute inset-0 rounded-lg" 
      />

      {/* Info trajet - positioned on the left */}
      <div className="absolute top-4 left-4 bg-primary/90 text-primary-foreground rounded-lg p-2 sm:p-3 shadow-lg z-10">
        <div className="font-semibold text-xs sm:text-sm whitespace-nowrap">
          {planningData.tripType === 'round-trip' ? '🔄 Aller-Retour' : '➡️ Aller Simple'}
        </div>
      </div>
    </div>
  );
});

Map.displayName = 'Map';

export default Map;