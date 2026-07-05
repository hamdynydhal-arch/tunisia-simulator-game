import EventToast from "@/components/EventToast";
import GameHud from "@/components/GameHud";
import MapPanel from "@/components/MapPanel";
import RegionSidebar from "@/components/RegionSidebar";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <GameHud />
      <EventToast />
      {/* overflow-x-clip contains the sidebar's slide-in animation */}
      <div className="flex flex-1 overflow-x-clip">
        {/* DOM-first in an RTL row = pinned to the physical right edge on desktop */}
        <RegionSidebar />
        {/* relative + z-0 sizes the absolute map fill and keeps Leaflet's
            internal z-indexes (up to 1000) below the sidebar and toast */}
        <main className="relative z-0 flex-1">
          <MapPanel />
        </main>
      </div>
    </div>
  );
}
