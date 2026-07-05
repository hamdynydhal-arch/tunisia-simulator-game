declare module "polylabel" {
  /**
   * Pole of inaccessibility: the interior point of a polygon farthest from
   * its edges. `polygon` is GeoJSON Polygon coordinates (rings of [x, y]).
   */
  export default function polylabel(
    polygon: number[][][],
    precision?: number,
  ): [number, number] & { distance: number };
}
