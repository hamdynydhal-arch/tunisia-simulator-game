import polylabel from "polylabel";
import type { FeatureCollection, Geometry, Position } from "geojson";
import governoratesJson from "@/data/tunisia-governorates.json";
import type { RegionId } from "@/types/game";

interface GovernorateProperties {
  id: RegionId;
  name: string;
  iso: string;
}

const governorates = governoratesJson as unknown as FeatureCollection<
  Geometry,
  GovernorateProperties
>;

function ringArea(ring: Position[]): number {
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(area / 2);
}

function interiorPoint(geometry: Geometry): [number, number] {
  // For MultiPolygons, label the largest part; polylabel then finds the
  // point deepest inside it, so markers never land outside a concave shape.
  let polygon: Position[][];
  if (geometry.type === "Polygon") {
    polygon = geometry.coordinates;
  } else if (geometry.type === "MultiPolygon") {
    polygon = geometry.coordinates.reduce((largest, candidate) =>
      ringArea(candidate[0]) > ringArea(largest[0]) ? candidate : largest,
    );
  } else {
    throw new Error(`unsupported geometry: ${geometry.type}`);
  }
  const [lng, lat] = polylabel(polygon as number[][][], 0.005);
  return [lat, lng];
}

/** Guaranteed-interior anchor point ([lat, lng]) for each governorate. */
export const REGION_POINTS: Record<RegionId, [number, number]> =
  Object.fromEntries(
    governorates.features.map((feature) => [
      feature.properties.id,
      interiorPoint(feature.geometry),
    ]),
  ) as Record<RegionId, [number, number]>;

/**
 * Deterministic position for the k-th completed project of a region:
 * the interior point itself, then a golden-angle spiral around it so
 * several markers in one governorate never overlap.
 */
export function projectMarkerPosition(
  regionId: RegionId,
  index: number,
): [number, number] {
  const [lat, lng] = REGION_POINTS[regionId];
  if (index === 0) {
    return [lat, lng];
  }
  const angle = index * 2.39996; // golden angle in radians
  const radius = 0.05 * Math.sqrt(index);
  return [
    lat + radius * Math.cos(angle),
    // stretch east-west a little to compensate for longitude compression
    lng + radius * Math.sin(angle) * 1.2,
  ];
}
