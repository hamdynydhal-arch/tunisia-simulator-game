import CompletionToasts from "@/components/CompletionToasts";
import EventToast from "@/components/EventToast";
import FloatingEffects from "@/components/FloatingEffects";
import GameHud from "@/components/GameHud";
import MapPanel from "@/components/MapPanel";
import PoliticalEventModal from "@/components/PoliticalEventModal";
import RegionSidebar from "@/components/RegionSidebar";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <GameHud />
      <EventToast />
      <CompletionToasts />
      <FloatingEffects />
      <PoliticalEventModal />
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
