// Shared route types for the application
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface RouteGeoJSON {
  outboundCoordinates?: [number, number][];
  returnCoordinates?: [number, number][];
  samePathReturn?: boolean;
}

export interface RouteData {
  distance: number;
  duration: number;
  calories: number;
  steps: number;
  startCoordinates: Coordinates;
  endCoordinates: Coordinates;
  routeGeoJSON?: RouteGeoJSON;
}

export interface PlanningData {
  steps: number;
  pace: 'slow' | 'moderate' | 'fast';
  tripType: 'one-way' | 'round-trip';
  height: number;
  weight: number;
}

export interface MapboxRoute {
  geometry: RouteGeometry;
  distance: number;
  duration?: number;
}