"use client";

import { useEffect, useRef, useState } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import type {
  GeoJSON as LeafletGeoJSON,
  LatLngBoundsExpression,
  Layer,
  Path,
  PathOptions,
} from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import "leaflet/dist/leaflet.css";
import governoratesJson from "@/data/tunisia-governorates.json";
import { INITIAL_REGIONS } from "@/data/regions";
import { useGameStore } from "@/store/gameStore";
import type { RegionId } from "@/types/game";

interface GovernorateProperties {
  id: RegionId;
  name: string;
  iso: string;
}

type GovernorateFeature = Feature<Geometry, GovernorateProperties>;

const governorates = governoratesJson as unknown as FeatureCollection<
  Geometry,
  GovernorateProperties
>;

const TUNISIA_BOUNDS: LatLngBoundsExpression = [
  [30.23, 7.52],
  [37.55, 11.6],
];

/** Loose bounds so the player can pan across Algeria and Libya, not the world. */
const PAN_BOUNDS: LatLngBoundsExpression = [
  [24, -1],
  [42, 20],
];

// Transparent fills so the real map (roads, terrain, borders) stays readable.
const BASE_STYLE: PathOptions = {
  color: "#94a3b8",
  weight: 1.2,
  fillColor: "#475569",
  fillOpacity: 0.12,
};
const HOVER_STYLE: PathOptions = {
  color: "#fde68a",
  weight: 2,
  fillColor: "#f59e0b",
  fillOpacity: 0.3,
};
const SELECTED_STYLE: PathOptions = {
  color: "#6ee7b7",
  weight: 2.5,
  fillColor: "#10b981",
  fillOpacity: 0.3,
};

function toggleRegion(id: RegionId) {
  const { selectedRegionId, selectRegion } = useGameStore.getState();
  selectRegion(selectedRegionId === id ? null : id);
}

function GovernorateLayer() {
  const selectedRegionId = useGameStore((state) => state.selectedRegionId);
  const [hoveredId, setHoveredId] = useState<RegionId | null>(null);
  const layerRef = useRef<LeafletGeoJSON | null>(null);

  const styleFor = (id: RegionId): PathOptions =>
    id === selectedRegionId
      ? SELECTED_STYLE
      : id === hoveredId
        ? HOVER_STYLE
        : BASE_STYLE;

  // Leaflet layers are imperative: restyle them when hover/selection changes.
  useEffect(() => {
    layerRef.current?.eachLayer((layer) => {
      const path = layer as Path & { feature?: GovernorateFeature };
      if (path.feature) {
        path.setStyle(styleFor(path.feature.properties.id));
      }
    });
  });

  const onEachFeature = (feature: GovernorateFeature, layer: Layer) => {
    const id = feature.properties.id;
    const arabicName = INITIAL_REGIONS[id]?.name ?? feature.properties.name;

    layer.bindTooltip(arabicName, {
      sticky: true,
      direction: "top",
      className: "region-tooltip",
    });
    layer.on({
      mouseover: () => setHoveredId(id),
      mouseout: () => setHoveredId((current) => (current === id ? null : current)),
      click: () => toggleRegion(id),
    });

    // Keyboard/screen-reader parity with the old SVG map.
    layer.once("add", () => {
      const el = (layer as Path).getElement() as SVGElement | undefined;
      if (!el) {
        return;
      }
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", `ولاية ${arabicName}`);
      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleRegion(id);
        }
      });
      el.addEventListener("focus", () => setHoveredId(id));
      el.addEventListener("blur", () =>
        setHoveredId((current) => (current === id ? null : current)),
      );
    });
  };

  return (
    <GeoJSON
      ref={layerRef}
      data={governorates}
      style={(feature) =>
        styleFor((feature as GovernorateFeature).properties.id)
      }
      onEachFeature={onEachFeature}
    />
  );
}

export interface TunisiaMapProps {
  className?: string;
}

/**
 * Real-world Leaflet map (CARTO Dark Matter tiles: roads, terrain and the
 * Algerian/Libyan borders) with the 24 governorates overlaid as an
 * interactive GeoJSON layer. Browser-only — always load via `next/dynamic`
 * with `ssr: false` (see MapPanel).
 */
export default function TunisiaMap({ className }: TunisiaMapProps) {
  return (
    <MapContainer
      bounds={TUNISIA_BOUNDS}
      maxBounds={PAN_BOUNDS}
      minZoom={5}
      maxZoom={14}
      className={className ?? "h-full w-full"}
      style={{ background: "#0f172a" }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
      />
      <GovernorateLayer />
    </MapContainer>
  );
}
