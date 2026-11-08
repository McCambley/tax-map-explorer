import { useEffect, useState } from 'react';

export interface Fix {
  lng: number;
  lat: number;
  accuracy: number; // meters
  heading: number | null; // degrees, only while moving
  speed: number | null; // m/s
}

export type GeoState =
  | { status: 'off' }
  | { status: 'locating' }
  | { status: 'tracking'; fix: Fix }
  | { status: 'error'; message: string };

/** Continuous high-accuracy GPS while `enabled`. */
export function useGeolocation(enabled: boolean): GeoState {
  const [state, setState] = useState<GeoState>({ status: 'off' });

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'off' });
      return;
    }
    if (!('geolocation' in navigator)) {
      setState({ status: 'error', message: 'This browser has no GPS support.' });
      return;
    }
    setState({ status: 'locating' });
    const id = navigator.geolocation.watchPosition(
      ({ coords }) =>
        setState({
          status: 'tracking',
          fix: {
            lng: coords.longitude,
            lat: coords.latitude,
            accuracy: coords.accuracy,
            heading: Number.isFinite(coords.heading) ? coords.heading : null,
            speed: coords.speed,
          },
        }),
      (err) =>
        setState({
          status: 'error',
          message:
            err.code === err.PERMISSION_DENIED
              ? 'Location permission denied. Allow it in browser settings.'
              : err.message || 'Could not get location.',
        }),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return state;
}
