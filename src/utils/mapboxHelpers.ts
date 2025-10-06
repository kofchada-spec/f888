import mapboxgl from 'mapbox-gl';

/**
 * Initialize Mapbox map with standard configuration
 */
export const initializeMap = (
  container: HTMLDivElement,
  accessToken: string,
  center?: [number, number],
  zoom?: number
): mapboxgl.Map => {
  console.log('🗺️ [initializeMap] Début initialisation avec token:', !!accessToken);
  console.log('🗺️ [initializeMap] Container:', !!container);
  console.log('🗺️ [initializeMap] Center:', center);
  
  mapboxgl.accessToken = accessToken;
  
  console.log('🗺️ [initializeMap] Création de l\'instance Map...');
  const map = new mapboxgl.Map({
    container,
    style: 'mapbox://styles/mapbox/streets-v12',
    zoom: zoom || 14,
    center: center || [2.3522, 48.8566], // Default to Paris
  });
  console.log('🗺️ [initializeMap] Instance Map créée:', !!map);

  // Add navigation controls
  console.log('🗺️ [initializeMap] Ajout des contrôles de navigation...');
  map.addControl(
    new mapboxgl.NavigationControl({
      visualizePitch: true,
    }),
    'top-right'
  );

  // Add geolocate control and trigger it automatically
  const geolocateControl = new mapboxgl.GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true
    },
    trackUserLocation: true,
    showUserLocation: true,
    showAccuracyCircle: false
  });
  
  map.addControl(geolocateControl, 'top-right');
  
  // Auto-trigger geolocation on map load
  map.on('load', () => {
    setTimeout(() => {
      geolocateControl.trigger();
    }, 1000);
  });

  // Error handling
  map.on('error', (e) => {
    console.error('Mapbox error:', e.error);
    if (e.error?.message?.includes('401') || e.error?.message?.includes('403')) {
      console.error('Authentication error - check your Mapbox token');
    }
  });

  return map;
};

/**
 * Get Mapbox token from Supabase edge function
 */
export const getMapboxToken = async (): Promise<string | null> => {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    
    // Get current session for authentication
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.error('No active session - authentication required');
      return null;
    }
    
    const { data, error } = await supabase.functions.invoke('mapbox-token', {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });
    
    if (error) {
      console.error('Error calling mapbox-token function:', error);
      throw error;
    }
    
    if (data?.token && typeof data.token === 'string' && data.token.startsWith('pk.')) {
      console.log('Valid Mapbox token received');
      return data.token;
    } else {
      console.error('Invalid token received:', data);
      throw new Error('Invalid token received');
    }
  } catch (error) {
    console.error('Error fetching Mapbox token:', error);
    console.log('Please check your MAPBOX_PUBLIC_TOKEN in Supabase secrets');
    return null;
  }
};

/**
 * Setup map interaction handlers
 */
export const setupMapInteractions = (map: mapboxgl.Map): void => {
  map.on('load', () => {
    // Resize map to ensure proper rendering
    setTimeout(() => {
      map.resize();
    }, 100);

    // Setup POI interactions if layer exists
    if (map.getLayer('poi-label')) {
      map.on('click', 'poi-label', (e) => {
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
          .addTo(map);
      });

      map.on('mouseenter', 'poi-label', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'poi-label', () => {
        map.getCanvas().style.cursor = '';
      });
    }
  });
};