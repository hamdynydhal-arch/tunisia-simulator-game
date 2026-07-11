import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import AutoAdvance from "@/components/AutoAdvance";
import CompletionToasts from "@/components/CompletionToasts";
import CrisisCenterModal from "@/components/CrisisCenterModal";
import EventToast from "@/components/EventToast";
import FloatingEffects from "@/components/FloatingEffects";
import GameHud from "@/components/GameHud";
import GameOverModal from "@/components/GameOverModal";
import MapPanel from "@/components/MapPanel";
import OutcomeScreen from "@/components/OutcomeScreen";
import PoliticalEventModal from "@/components/PoliticalEventModal";
import RegionSidebar from "@/components/RegionSidebar";
import VictoryScreen from "@/components/VictoryScreen";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <GameHud />
      <EventToast />
      <CompletionToasts />
      <FloatingEffects />
      <PoliticalEventModal />
      <AnalyticsDashboard />
      <CrisisCenterModal />
      <OutcomeScreen />
      <GameOverModal />
      <VictoryScreen />
      <AutoAdvance />
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
