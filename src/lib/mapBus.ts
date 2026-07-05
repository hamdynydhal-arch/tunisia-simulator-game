import type { Map as LeafletMap } from "leaflet";

/**
 * Bridge between the Leaflet map (which lives deep inside MapContainer)
 * and UI chrome outside it (toasts, floating effects). The map registers
 * itself on mount; anyone can then ask for a flight or listen for the
 * "arrived" moment.
 */

type ArrivalHandler = (screen: { x: number; y: number }) => void;

let map: LeafletMap | null = null;
const arrivalHandlers = new Set<ArrivalHandler>();

export function registerMap(instance: LeafletMap): void {
  map = instance;
}

export function unregisterMap(instance: LeafletMap): void {
  if (map === instance) {
    map = null;
  }
}

/** Screen (viewport) pixel position of a lat/lng, or null without a map. */
function toScreen(latlng: [number, number]): { x: number; y: number } | null {
  if (!map) {
    return null;
  }
  const point = map.latLngToContainerPoint(latlng);
  const rect = map.getContainer().getBoundingClientRect();
  return { x: rect.left + point.x, y: rect.top + point.y };
}

/**
 * Flies the camera to a region's anchor point; when the flight ends,
 * notifies arrival listeners with the point's on-screen position.
 */
export function flyToRegion(latlng: [number, number], zoom = 9): void {
  if (!map) {
    return;
  }
  map.once("moveend", () => {
    const screen = toScreen(latlng);
    if (screen) {
      arrivalHandlers.forEach((handler) => handler(screen));
    }
  });
  map.flyTo(latlng, zoom, { duration: 1.3 });
}

/** Subscribe to flight arrivals; returns an unsubscribe function. */
export function onArrival(handler: ArrivalHandler): () => void {
  arrivalHandlers.add(handler);
  return () => {
    arrivalHandlers.delete(handler);
  };
}
