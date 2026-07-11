"use client";

import { useEffect, useRef, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
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
import { REGION_POINTS } from "@/lib/regionPoints";
import { registerMap, unregisterMap } from "@/lib/mapBus";
import { useGameStore } from "@/store/gameStore";
import type { Region, RegionId } from "@/types/game";

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

function toggleRegion(id: RegionId) {
  const { selectedRegionId, selectRegion } = useGameStore.getState();
  selectRegion(selectedRegionId === id ? null : id);
}

/**
 * Live heatmap stops: dark red (underdeveloped) → slate/gray (mid-tier) →
 * dark blue/green (thriving), keyed directly to developmentIndex so the map
 * itself reads as a development heatmap at a glance.
 */
const DEV_HEAT_STOPS: readonly (readonly [number, readonly [number, number, number]])[] = [
  [0, [127, 29, 29]], // dark red — low, < 30
  [30, [71, 85, 105]], // slate-600 — medium
  [75, [6, 78, 59]], // dark emerald — high, > 75
  [100, [8, 47, 73]], // deep blue-green — very high
];

function developmentHeatColor(developmentIndex: number): string {
  const d = Math.min(100, Math.max(0, developmentIndex));
  for (let i = 0; i < DEV_HEAT_STOPS.length - 1; i++) {
    const [d0, c0] = DEV_HEAT_STOPS[i];
    const [d1, c1] = DEV_HEAT_STOPS[i + 1];
    if (d <= d1 || i === DEV_HEAT_STOPS.length - 2) {
      const t = d1 === d0 ? 0 : Math.min(1, Math.max(0, (d - d0) / (d1 - d0)));
      const mix = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
      return `rgb(${mix[0]} ${mix[1]} ${mix[2]})`;
    }
  }
  const last = DEV_HEAT_STOPS[DEV_HEAT_STOPS.length - 1][1];
  return `rgb(${last[0]} ${last[1]} ${last[2]})`;
}

/**
 * Choropleth style for a governorate: the fill is a live developmentIndex
 * heatmap (dark red → slate → dark blue/green) at ~30% opacity so the
 * satellite imagery shows through, heavily tinted. Hover and selection change
 * only the STROKE and a slight opacity bump, so the heatmap stays readable in
 * every state. Rebel-held regions keep their normal choropleth fill; the
 * loss of sovereignty is signalled instead by a pulsing dark beacon (see
 * RebelMarkers).
 */
function styleForRegion(
  region: Region,
  isSelected: boolean,
  isHovered: boolean,
): PathOptions {
  const fillColor = developmentHeatColor(region.developmentIndex);
  if (isSelected) {
    return { color: "#34d399", weight: 3, opacity: 1, fillColor, fillOpacity: 0.42 };
  }
  if (isHovered) {
    return { color: "#fbbf24", weight: 2.5, opacity: 1, fillColor, fillOpacity: 0.4 };
  }
  return { color: "#f8fafc", weight: 1, opacity: 0.7, fillColor, fillOpacity: 0.3 };
}

function GovernorateLayer() {
  const selectedRegionId = useGameStore((state) => state.selectedRegionId);
  const regions = useGameStore((state) => state.regions);
  const [hoveredId, setHoveredId] = useState<RegionId | null>(null);
  const layerRef = useRef<LeafletGeoJSON | null>(null);

  const styleFor = (id: RegionId): PathOptions =>
    styleForRegion(regions[id], id === selectedRegionId, id === hoveredId);

  // Leaflet layers are imperative: restyle them when hover, selection, or the
  // regions' socio-economic state (hence the choropleth colors) changes.
  useEffect(() => {
    layerRef.current?.eachLayer((layer) => {
      const path = layer as Path & { feature?: GovernorateFeature };
      if (path.feature) {
        const id = path.feature.properties.id;
        path.setStyle(styleFor(id));
        // Live crisis glow: a pulsing red stroke on this specific region's
        // path while a strike or border infiltration is active there —
        // geographically visible, not just a badge in a list.
        const el = path.getElement() as SVGElement | undefined;
        const region = regions[id];
        if (el && region) {
          el.classList.toggle(
            "crisis-glow",
            region.isStriking || region.activeInfiltration,
          );
        }
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

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const completedIconCache = new Map<string, DivIcon>();

/** Final, solid marker for a completed zone project. */
function projectIcon(projectId: string): DivIcon {
  let icon = completedIconCache.get(projectId);
  if (!icon) {
    const style = PROJECT_STYLE[projectId];
    icon = divIcon({
      html: `<span>${style?.glyph ?? "\u{1F3D7}\u{FE0F}"}</span>`,
      className: `project-marker project-marker--${style?.category ?? "economy"}`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    completedIconCache.set(projectId, icon);
  }
  return icon;
}

const RING_RADIUS = 13;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

/**
 * Under-construction marker: the project glyph inside an animated circular
 * progress ring whose amber arc fills clockwise as the months elapse. A
 * fresh icon is built each tick so the arc advances toward 100%.
 */
function constructionIcon(projectId: string, progress: number): DivIcon {
  const glyph = PROJECT_STYLE[projectId]?.glyph ?? "\u{1F3D7}\u{FE0F}";
  const offset = (RING_CIRC * (1 - clamp01(progress))).toFixed(1);
  const pct = Math.round(clamp01(progress) * 100);
  return divIcon({
    className: "construction-marker",
    html:
      `<div class="cm-wrap" role="img" aria-label="قيد الإنجاز ${pct}٪">` +
      `<svg viewBox="0 0 32 32" class="cm-ring">` +
      `<circle class="cm-track" cx="16" cy="16" r="${RING_RADIUS}"/>` +
      `<circle class="cm-prog" cx="16" cy="16" r="${RING_RADIUS}" ` +
      `stroke-dasharray="${RING_CIRC.toFixed(1)}" stroke-dashoffset="${offset}" ` +
      `transform="rotate(-90 16 16)"/>` +
      `</svg>` +
      `<span class="cm-glyph">${glyph}</span>` +
      `</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

/**
 * All project infrastructure on the map, in both states. Completed projects
 * render as solid markers (or amber highway polylines); active projects
 * render at the SAME procedurally-placed spot in an under-construction state
 * (progress ring / faint dashed road) and swap to the final icon on
 * completion — the position never jumps because placement is pure in the
 * project's instance id.
 */
function MapInfrastructure() {
  const activeProjects = useGameStore((state) => state.activeProjects);
  const completedProjects = useGameStore((state) => state.completedProjects);
  const select = (regionId: RegionId) =>
    useGameStore.getState().selectRegion(regionId);

  return (
    <>
      {/* Completed */}
      {completedProjects.map((project) => {
        const name =
          getProjectTemplate(project.projectId)?.name ?? project.projectId;
        if (LINEAR_PROJECTS.has(project.projectId)) {
          return (
            <Polyline
              key={project.instanceId}
              positions={highwayPath(project.regionId, project.instanceId)}
              pathOptions={{
                color: "#fbbf24",
                weight: 3,
                opacity: 0.85,
                dashArray: "10 6",
              }}
              eventHandlers={{ click: () => select(project.regionId) }}
            >
              <Tooltip sticky className="region-tooltip">
                {name}
              </Tooltip>
            </Polyline>
          );
        }
        return (
          <Marker
            key={project.instanceId}
            position={placeZoneProject(project.regionId, project.instanceId)}
            icon={projectIcon(project.projectId)}
            eventHandlers={{ click: () => select(project.regionId) }}
          >
            <Tooltip direction="top" className="region-tooltip">
              {name}
            </Tooltip>
          </Marker>
        );
      })}

      {/* Under construction */}
      {activeProjects.map((project) => {
        const template = getProjectTemplate(project.projectId);
        const duration = template?.durationMonths ?? 1;
        const progress = clamp01((duration - project.monthsRemaining) / duration);
        const pct = Math.round(progress * 100);
        const name = template?.name ?? project.projectId;
        if (LINEAR_PROJECTS.has(project.projectId)) {
          return (
            <Polyline
              key={project.instanceId}
              positions={highwayPath(project.regionId, project.instanceId)}
              pathOptions={{
                color: "#94a3b8",
                weight: 2,
                opacity: 0.55,
                dashArray: "4 8",
              }}
              eventHandlers={{ click: () => select(project.regionId) }}
            >
              <Tooltip sticky className="region-tooltip">
                {name} — قيد الإنجاز {pct}٪
              </Tooltip>
            </Polyline>
          );
        }
        return (
          <Marker
            key={project.instanceId}
            position={placeZoneProject(project.regionId, project.instanceId)}
            icon={constructionIcon(project.projectId, progress)}
            eventHandlers={{ click: () => select(project.regionId) }}
          >
            <Tooltip direction="top" className="region-tooltip">
              {name} — قيد الإنجاز {pct}٪
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}

/** Icon, color class, and label for each active-event map marker. */
const EVENT_MARKER: Record<
  string,
  { glyph: string; kind: "crisis" | "boom"; label: string }
> = {
  riots: { glyph: "\u{1F525}", kind: "crisis", label: "احتجاجات" },
  "border-crisis": { glyph: "\u{1F6A8}", kind: "crisis", label: "أزمة حدودية" },
  smuggling: { glyph: "\u{1F4E6}", kind: "crisis", label: "تهريب" },
  harga: { glyph: "\u{26F5}", kind: "crisis", label: "هجرة بحرية غير نظامية" },
  terrorism: { glyph: "\u{1F4A5}", kind: "crisis", label: "إرهاب وتمرد مسلح" },
  "rebel-takeover": { glyph: "\u{1F3F4}", kind: "crisis", label: "فقدان السيطرة" },
  "citizen-initiative": {
    glyph: "\u{1F91D}",
    kind: "boom",
    label: "مبادرة مواطنية",
  },
  tourism: { glyph: "\u{1F389}", kind: "boom", label: "موسم سياحي" },
  harvest: { glyph: "\u{1F33E}", kind: "boom", label: "موسم فلاحي" },
  festival: { glyph: "\u{1F3AD}", kind: "boom", label: "مهرجان ثقافي" },
  fdi: { glyph: "⭐", kind: "boom", label: "استثمار أجنبي" },
};

const eventIconCache = new Map<string, DivIcon>();

function eventIcon(type: string): DivIcon {
  let icon = eventIconCache.get(type);
  if (!icon) {
    const marker = EVENT_MARKER[type];
    icon = divIcon({
      className: `event-marker event-marker--${marker.kind}`,
      html: `<span>${marker.glyph}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    eventIconCache.set(type, icon);
  }
  return icon;
}

/**
 * Pulsing markers for every active socio-political event, derived from the
 * per-region event cooldowns so each persists exactly as long as its event's
 * impact window. Placed above the governorate's centre; several in one region
 * fan out so they never fully overlap.
 */
function EventMarkers() {
  const cooldowns = useGameStore(
    (state) => state.gameState.regionEventCooldowns,
  );
  const perRegion: Partial<Record<RegionId, number>> = {};

  return (
    <>
      {Object.entries(cooldowns)
        .filter(([, months]) => months > 0)
        .map(([key, months]) => {
          const [type, regionId] = key.split(":") as [string, RegionId];
          const marker = EVENT_MARKER[type];
          if (!marker || !REGION_POINTS[regionId]) {
            return null;
          }
          const index = (perRegion[regionId] = (perRegion[regionId] ?? -1) + 1);
          const [lat, lng] = REGION_POINTS[regionId];
          const position: [number, number] = [
            lat + 0.16,
            lng + (index - 0.5) * 0.14,
          ];
          return (
            <Marker
              key={key}
              position={position}
              icon={eventIcon(type)}
              zIndexOffset={1000}
              eventHandlers={{
                click: () => useGameStore.getState().selectRegion(regionId),
              }}
            >
              <Tooltip direction="top" className="region-tooltip">
                {marker.label} — متبقي {months} شهرًا
              </Tooltip>
            </Marker>
          );
        })}
    </>
  );
}

/**
 * A pulsing dark beacon over every rebel-held governorate, placed at the
 * region's centroid. It replaces the old charcoal polygon fill: the choropleth
 * stays readable while a prominent, animated marker marks where the State has
 * lost its monopoly on violence — and, during a siege, how many months remain.
 */
function RebelMarkers() {
  const regions = useGameStore((state) => state.regions);

  return (
    <>
      {Object.values(regions)
        .filter((region) => region.isUnderRebelControl)
        .map((region) => {
          const point = REGION_POINTS[region.id];
          if (!point) {
            return null;
          }
          return (
            <CircleMarker
              key={region.id}
              center={point}
              radius={13}
              // These must be top-level props, not `pathOptions`: react-leaflet
              // applies pathOptions via Leaflet's setStyle(), which ignores
              // className — the constructor only reads it at creation time.
              className="rebel-marker"
              color="#020617"
              weight={3}
              fillColor="#111827"
              fillOpacity={0.9}
              eventHandlers={{
                click: () => useGameStore.getState().selectRegion(region.id),
              }}
            >
              <Tooltip direction="top" className="region-tooltip">
                {region.name} —{" "}
                {region.siegeTurns > 0
                  ? `تحت الحصار · ${region.siegeTurns} أشهر متبقية`
                  : "خارج سيطرة الدولة"}
              </Tooltip>
            </CircleMarker>
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
      <MapInfrastructure />
      <RebelMarkers />
      <EventMarkers />
      <MapBridge />
    </MapContainer>
  );
}
