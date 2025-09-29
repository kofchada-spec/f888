import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PlanningData, RouteData } from '@/types/route';
import { initializeMap, getMapboxToken } from '@/utils/mapboxHelpers';
import { useMapClickLimiter } from '@/hooks/useMapClickLimiter';
import { useRoundTripRouteGeneration } from '@/hooks/useRoundTripRouteGeneration';
import { useOneWayRouteGeneration } from '@/hooks/useOneWayRouteGeneration';
import { useMapState } from '@/hooks/useMapState';
import { useMapRoutes } from '@/hooks/useMapRoutes';
import { calculateTargetDistance, getToleranceRange, calculateRouteMetrics } from '@/utils/routeCalculations';


