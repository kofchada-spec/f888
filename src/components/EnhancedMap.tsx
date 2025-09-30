import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PlanningData, RouteData, Coordinates } from '@/types/route';
import { getMapboxToken } from '@/utils/mapboxHelpers';
import { calculateTargetDistance } from '@/utils/routeCalculations';


