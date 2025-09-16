import { useCallback, useRef } from 'react';

interface PerformanceMetrics {
  geocode?: number;
  routing?: number;
  tilesFirstRender?: number;
  routeRender?: number;
  totalTime?: number;
}

export const useMapPerformance = () => {
  const metricsRef = useRef<PerformanceMetrics>({});
  const startTimeRef = useRef<number>(Date.now());

  const startTimer = useCallback((key: keyof PerformanceMetrics) => {
    const startTime = Date.now();
    return () => {
      metricsRef.current[key] = Date.now() - startTime;
    };
  }, []);

  const logPerformanceSummary = useCallback(() => {
    const metrics = metricsRef.current;
    const totalTime = Date.now() - startTimeRef.current;
    
    console.group('🚀 Map Performance Summary');
    console.log(`Geocode: ${metrics.geocode || 0}ms`);
    console.log(`Routing: ${metrics.routing || 0}ms`);
    console.log(`Tiles First Render: ${metrics.tilesFirstRender || 0}ms`);
    console.log(`Route Render: ${metrics.routeRender || 0}ms`);
    console.log(`Total Time: ${totalTime}ms`);
    console.groupEnd();

    // Reset for next measurement
    metricsRef.current = {};
    startTimeRef.current = Date.now();
  }, []);

  const resetMetrics = useCallback(() => {
    metricsRef.current = {};
    startTimeRef.current = Date.now();
  }, []);

  return {
    startTimer,
    logPerformanceSummary,
    resetMetrics,
    metrics: metricsRef.current
  };
};