import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface RouteCache {
  [key: string]: {
    data: any;
    timestamp: number;
  };
}

interface UserLocation {
  lat: number;
  lng: number;
}

interface PlanningData {
  steps: string;
  pace: 'slow' | 'moderate' | 'fast';
  tripType: 'one-way' | 'round-trip';
  height: string;
  weight: string;
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const REQUEST_TIMEOUT = 6000; // 6 seconds
const DEBOUNCE_DELAY = 700; // 700ms

export const useOptimizedRouting = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const cacheRef = useRef<RouteCache>({});
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();
  const retryCountRef = useRef(0);

  // Generate cache key for route
  const generateCacheKey = useCallback((
    origin: UserLocation,
    destination: UserLocation,
    planningData: PlanningData
  ) => {
    const roundedOriginLat = Math.round(origin.lat * 1000) / 1000;
    const roundedOriginLng = Math.round(origin.lng * 1000) / 1000;
    const roundedDestLat = Math.round(destination.lat * 1000) / 1000;
    const roundedDestLng = Math.round(destination.lng * 1000) / 1000;
    
    return `${roundedOriginLat},${roundedOriginLng}_${roundedDestLat},${roundedDestLng}_${planningData.tripType}_${planningData.pace}`;
  }, []);

  // Check cache for existing route
  const getCachedRoute = useCallback((cacheKey: string) => {
    const cached = cacheRef.current[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('📦 Using cached route:', cacheKey);
      return cached.data;
    }
    return null;
  }, []);

  // Store route in cache
  const setCachedRoute = useCallback((cacheKey: string, data: any) => {
    cacheRef.current[cacheKey] = {
      data,
      timestamp: Date.now()
    };
    console.log('💾 Cached route:', cacheKey);
  }, []);

  // Cancel previous request
  const cancelPreviousRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('❌ Cancelled previous routing request');
    }
  }, []);

  // Fetch route with timeout and retry logic  
  const fetchRouteWithTimeout = useCallback(async (
    userLocation: UserLocation,
    planningData: PlanningData,
    profileData?: any
  ): Promise<any> => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT);

    try {
      console.log('🔄 Fetching route with timeout:', REQUEST_TIMEOUT + 'ms');
      const startTime = Date.now();

      const { data, error } = await supabase.functions.invoke('mapbox-destinations', {
        body: { 
          userLocation, 
          planningData,
          profileData,
          generateThree: true
        }
      });

      clearTimeout(timeoutId);
      
      if (error) throw error;
      
      const duration = Date.now() - startTime;
      console.log(`✅ Route fetched in ${duration}ms`);
      
      return data;
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      if (err.name === 'AbortError') {
        throw new Error('Request timeout or cancelled');
      }
      throw err;
    }
  }, []);

  // Main routing function with debouncing, caching, and retries
  const fetchOptimizedRoute = useCallback(async (
    userLocation: UserLocation,
    planningData: PlanningData,
    profileData?: any
  ): Promise<any> => {
    // Cancel previous debounced request
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    return new Promise((resolve, reject) => {
      debounceTimerRef.current = setTimeout(async () => {
        try {
          setLoading(true);
          setError(null);
          
          // Generate cache key - using a simplified version for destinations
          const cacheKey = `dest_${Math.round(userLocation.lat * 1000)}_${Math.round(userLocation.lng * 1000)}_${planningData.steps}_${planningData.tripType}`;
          
          // Check cache first
          const cachedData = getCachedRoute(cacheKey);
          if (cachedData) {
            setLoading(false);
            resolve(cachedData);
            return;
          }

          // Cancel any previous request
          cancelPreviousRequest();
          
          let lastError: Error | null = null;
          const maxRetries = 2;
          
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              const data = await fetchRouteWithTimeout(userLocation, planningData, profileData);
              
              // Cache the result
              setCachedRoute(cacheKey, data);
              
              setLoading(false);
              retryCountRef.current = 0;
              resolve(data);
              return;
              
            } catch (err: any) {
              lastError = err;
              
              if (attempt < maxRetries && err.message !== 'Request timeout or cancelled') {
                const backoffDelay = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.log(`🔄 Retry ${attempt + 1}/${maxRetries} in ${backoffDelay}ms`);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
              }
            }
          }
          
          // All retries failed
          const errorMsg = `Route unavailable after ${maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`;
          setError(errorMsg);
          toast({
            title: "Route unavailable",
            description: "Please try again or select a different location",
            variant: "destructive"
          });
          
          setLoading(false);
          reject(new Error(errorMsg));
          
        } catch (err: any) {
          setError(err.message || 'Unknown error');
          setLoading(false);
          reject(err);
        }
      }, DEBOUNCE_DELAY);
    });
  }, [getCachedRoute, setCachedRoute, cancelPreviousRequest, fetchRouteWithTimeout]);

  // Clear cache manually
  const clearCache = useCallback(() => {
    cacheRef.current = {};
    console.log('🗑️ Route cache cleared');
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    cancelPreviousRequest();
  }, [cancelPreviousRequest]);

  return {
    loading,
    error,
    fetchOptimizedRoute,
    clearCache,
    cleanup,
    cacheSize: Object.keys(cacheRef.current).length
  };
};