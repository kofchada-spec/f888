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
  mapboxgl.accessToken = accessToken;
  
  const map = new mapboxgl.Map({
    container,
    style: 'mapbox://styles/mapbox/streets-v12',
    zoom: zoom || 14,
    center: center || [2.3522, 48.8566], // Default to Paris
  });

  // Add navigation controls
  map.addControl(
    new mapboxgl.NavigationControl({
      visualizePitch: true,
    }),
    'top-right'
  );

  // Add geolocate control
  map.addControl(
    new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true
      },
      trackUserLocation: true,
      showUserLocation: true
    }),
    'top-right'
  );

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
    const { data, error } = await supabase.functions.invoke('mapbox-token');
    
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