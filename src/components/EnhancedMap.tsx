import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PlanningData, RouteData, Coordinates } from '@/types/route';
import { getMapboxToken } from '@/utils/mapboxHelpers';
import { calculateTargetDistance } from '@/utils/routeCalculations';

interface EnhancedMapProps {
  planningData: PlanningData;
  onRouteCalculated: (route: RouteData) => void;
  manualSelectionEnabled?: boolean;
}

const EnhancedMap: React.FC<EnhancedMapProps> = ({ 
  planningData, 
  onRouteCalculated,
  manualSelectionEnabled = true
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
};

export default EnhancedMap;
