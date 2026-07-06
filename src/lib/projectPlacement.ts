import type { FeatureCollection, Geometry, Position } from "geojson";
import governoratesJson from "@/data/tunisia-governorates.json";
import { REGION_POINTS } from "@/lib/regionPoints";
import { REGION_IDS, type RegionId } from "@/types/game";

interface GovernorateProperties {
  id: RegionId;
  name: string;
  iso: string;
}

const governorates = governoratesJson as unknown as FeatureCollection<
  Geometry,
  GovernorateProperties
>;

/** Outer rings of each governorate ([lng, lat] positions). */
const RINGS_BY_REGION: Record<RegionId, Position[][]> = Object.fromEntries(
  governorates.features.map((feature) => {
    const geometry = feature.geometry;
    const rings =
      geometry.type === "Polygon"
        ? [geometry.coordinates[0]]
        : geometry.type === "MultiPolygon"
          ? geometry.coordinates.map((polygon) => polygon[0])
          : [];
    return [feature.properties.id, rings];
  }),
) as Record<RegionId, Position[][]>;

const BBOX_BY_REGION: Record<
  RegionId,
  [number, number, number, number]
> = Object.fromEntries(
  Object.entries(RINGS_BY_REGION).map(([id, rings]) => {
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
      }
    }
    return [id, [minLng, minLat, maxLng, maxLat]];
  }),
) as Record<RegionId, [number, number, number, number]>;

function ringContains(ring: Position[], lng: number, lat: number): boolean {
  // Ray casting; good enough at governorate scale.
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Whether [lat, lng] falls inside the governorate's territory. */
export function isInsideRegion(
  regionId: RegionId,
  lat: number,
  lng: number,
): boolean {
  return RINGS_BY_REGION[regionId].some((ring) =>
    ringContains(ring, lng, lat),
  );
}

/** FNV-1a hash so placements are deterministic per project instance. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Minimum spacing between two zone projects in one region, in degrees. */
const MIN_SPACING_DEG = 0.07;

/**
 * Procedural placement of a zone project: a pseudo-random point seeded by
 * the instance id (stable across renders and reloads), rejection-sampled to
 * be strictly INSIDE the governorate polygon and spaced away from projects
 * already placed there. Falls back to the deepest interior point.
 */
export function placeZoneProject(
  regionId: RegionId,
  instanceId: string,
  taken: readonly [number, number][],
): [number, number] {
  const rand = mulberry32(hashString(instanceId));
  const [minLng, minLat, maxLng, maxLat] = BBOX_BY_REGION[regionId];
  let fallback: [number, number] | null = null;

  for (let attempt = 0; attempt < 80; attempt++) {
    const lng = minLng + rand() * (maxLng - minLng);
    const lat = minLat + rand() * (maxLat - minLat);
    if (!isInsideRegion(regionId, lat, lng)) {
      continue;
    }
    fallback ??= [lat, lng];
    const spaced = taken.every(
      ([takenLat, takenLng]) =>
        Math.hypot(takenLat - lat, takenLng - lng) >= MIN_SPACING_DEG,
    );
    if (spaced) {
      return [lat, lng];
    }
  }
  return fallback ?? REGION_POINTS[regionId];
}

/** Region anchor points sorted by distance from each governorate. */
const NEIGHBORS_BY_REGION = Object.fromEntries(
    REGION_IDS.map((id) => {
      const [lat, lng] = REGION_POINTS[id];
      const others = REGION_IDS.filter((other) => other !== id).sort(
        (a, b) => {
          const [aLat, aLng] = REGION_POINTS[a];
          const [bLat, bLng] = REGION_POINTS[b];
          return (
            Math.hypot(aLat - lat, aLng - lng) -
            Math.hypot(bLat - lat, bLng - lng)
          );
        },
      );
      return [id, others];
    }),
) as unknown as Record<RegionId, readonly RegionId[]>;

/**
 * Path of the k-th highway of a region: a gently bent polyline from the
 * governorate's anchor toward its k-th nearest neighbour — reading as a
 * road link between the two urban centres rather than a floating icon.
 */
export function highwayPath(
  regionId: RegionId,
  index: number,
): [number, number][] {
  const from = REGION_POINTS[regionId];
  const neighbors = NEIGHBORS_BY_REGION[regionId];
  const to = REGION_POINTS[neighbors[Math.min(index, neighbors.length - 1)]];

  // Perpendicular bend at the midpoint, alternating sides per highway.
  const midLat = (from[0] + to[0]) / 2;
  const midLng = (from[1] + to[1]) / 2;
  const dLat = to[0] - from[0];
  const dLng = to[1] - from[1];
  const length = Math.hypot(dLat, dLng) || 1;
  const side = index % 2 === 0 ? 1 : -1;
  const bend = 0.12 * side;
  const mid: [number, number] = [
    midLat + (-dLng / length) * bend,
    midLng + (dLat / length) * bend,
  ];
  return [from, mid, to];
}
