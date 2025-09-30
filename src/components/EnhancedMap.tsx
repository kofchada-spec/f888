import React, { useRef } from 'react';
import { PlanningData, RouteData } from '@/types/route';

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

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
};

export default EnhancedMap;
