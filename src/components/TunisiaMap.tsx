"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import type {
  DivIcon,
  GeoJSON as LeafletGeoJSON,
  LatLngBoundsExpression,
  Layer,
  Path,
  PathOptions,
} from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import "leaflet/dist/leaflet.css";
import governoratesJson from "@/data/tunisia-governorates.json";
import { INITIAL_REGIONS } from "@/data/governorates";
import { getProjectTemplate } from "@/data/projects";
import { highwayPath, placeZoneProject } from "@/lib/projectPlacement";
import { registerMap, unregisterMap } from "@/lib/mapBus";
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

// Bright, slightly translucent strokes with near-transparent fills so the
// governorate outlines stay crisp over satellite imagery without hiding it.
const BASE_STYLE: PathOptions = {
  color: "#f8fafc",
  weight: 1.5,
  opacity: 0.75,
  fillColor: "#0f172a",
  fillOpacity: 0.08,
};
const HOVER_STYLE: PathOptions = {
  color: "#fbbf24",
  weight: 2.5,
  opacity: 1,
  fillColor: "#f59e0b",
  fillOpacity: 0.22,
};
const SELECTED_STYLE: PathOptions = {
  color: "#34d399",
  weight: 3,
  opacity: 1,
  fillColor: "#10b981",
  fillOpacity: 0.22,
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

/** Emoji glyph and category ring color for each project type. */
const PROJECT_STYLE: Record<string, { glyph: string; category: string }> = {
  "regional-hospital": { glyph: "\u{1F3E5}", category: "health" },
  highway: { glyph: "\u{1F6E3}\u{FE0F}", category: "transport" },
  "industrial-zone": { glyph: "\u{1F3ED}", category: "economy" },
  "commercial-port": { glyph: "\u2693", category: "economy" },
  "desalination-plant": { glyph: "\u{1F4A7}", category: "water" },
  "archaeological-restoration": { glyph: "\u{1F3DB}\u{FE0F}", category: "heritage" },
  "livestock-program": { glyph: "\u{1F411}", category: "economy" },
  "school-network": { glyph: "\u{1F3EB}", category: "knowledge" },
  university: { glyph: "\u{1F393}", category: "knowledge" },
  airport: { glyph: "\u2708\u{FE0F}", category: "transport" },
  "defense-base": { glyph: "\u{1F6E1}\u{FE0F}", category: "security" },
  "tech-hub": { glyph: "\u{1F4BB}", category: "knowledge" },
};

/** Projects drawn as lines on the map instead of point markers. */
const LINEAR_PROJECTS = new Set(["highway"]);

const iconCache = new Map<string, DivIcon>();

function projectIcon(projectId: string): DivIcon {
  let icon = iconCache.get(projectId);
  if (!icon) {
    const style = PROJECT_STYLE[projectId];
    icon = divIcon({
      html: `<span>${style?.glyph ?? "\u{1F3D7}\u{FE0F}"}</span>`,
      className: `project-marker project-marker--${style?.category ?? "economy"}`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    iconCache.set(projectId, icon);
  }
  return icon;
}

type PlacedInfrastructure =
  | { kind: "zone"; instanceId: string; projectId: string; regionId: RegionId; position: [number, number] }
  | { kind: "line"; instanceId: string; projectId: string; regionId: RegionId; path: [number, number][] };

/**
 * Completed infrastructure on the map: linear projects (highways) as bent
 * polylines linking the governorate to a neighbour; zone projects as
 * procedurally scattered markers strictly inside the polygon, spaced apart.
 * Clicking any piece of infrastructure selects its governorate.
 */
function CompletedInfrastructure() {
  const completedProjects = useGameStore((state) => state.completedProjects);

  const placed = useMemo<PlacedInfrastructure[]>(() => {
    const takenByRegion: Partial<Record<RegionId, [number, number][]>> = {};
    const linesByRegion: Partial<Record<RegionId, number>> = {};
    return completedProjects.map((project) => {
      if (LINEAR_PROJECTS.has(project.projectId)) {
        const index = linesByRegion[project.regionId] ?? 0;
        linesByRegion[project.regionId] = index + 1;
        return {
          kind: "line" as const,
          instanceId: project.instanceId,
          projectId: project.projectId,
          regionId: project.regionId,
          path: highwayPath(project.regionId, index),
        };
      }
      const taken = (takenByRegion[project.regionId] ??= []);
      const position = placeZoneProject(
        project.regionId,
        project.instanceId,
        taken,
      );
      taken.push(position);
      return {
        kind: "zone" as const,
        instanceId: project.instanceId,
        projectId: project.projectId,
        regionId: project.regionId,
        position,
      };
    });
  }, [completedProjects]);

  return (
    <>
      {placed.map((item) => {
        const name =
          getProjectTemplate(item.projectId)?.name ?? item.projectId;
        const select = () =>
          useGameStore.getState().selectRegion(item.regionId);
        if (item.kind === "line") {
          return (
            <Polyline
              key={item.instanceId}
              positions={item.path}
              pathOptions={{
                color: "#fbbf24",
                weight: 3,
                opacity: 0.85,
                dashArray: "10 6",
              }}
              eventHandlers={{ click: select }}
            >
              <Tooltip sticky className="region-tooltip">
                {name}
              </Tooltip>
            </Polyline>
          );
        }
        return (
          <Marker
            key={item.instanceId}
            position={item.position}
            icon={projectIcon(item.projectId)}
            eventHandlers={{ click: select }}
          >
            <Tooltip direction="top" className="region-tooltip">
              {name}
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}

/** Publishes the Leaflet instance so toasts can drive flyTo from outside. */
function MapBridge() {
  const map = useMap();
  useEffect(() => {
    registerMap(map);
    return () => unregisterMap(map);
  }, [map]);
  return null;
}

export interface TunisiaMapProps {
  className?: string;
}

/**
 * Real-world Leaflet map (Esri World Imagery satellite tiles) with the 24
 * governorates overlaid as an interactive GeoJSON layer. Browser-only —
 * always load via `next/dynamic` with `ssr: false` (see MapPanel).
 */
export default function TunisiaMap({ className }: TunisiaMapProps) {
  return (
    <MapContainer
      bounds={TUNISIA_BOUNDS}
      maxBounds={PAN_BOUNDS}
      minZoom={5}
      maxZoom={18}
      className={className ?? "h-full w-full"}
      style={{ background: "#0f172a" }}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
        maxZoom={18}
      />
      <GovernorateLayer />
      <CompletedInfrastructure />
      <MapBridge />
    </MapContainer>
  );
}
