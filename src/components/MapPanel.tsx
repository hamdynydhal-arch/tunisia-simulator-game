"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at import time, so the map must never be
// server-rendered; next/dynamic with ssr:false defers it to the client.
const TunisiaMap = dynamic(() => import("./TunisiaMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">
      جارٍ تحميل الخريطة…
    </div>
  ),
});

export default function MapPanel() {
  return (
    <div className="absolute inset-0">
      <TunisiaMap className="h-full w-full" />
    </div>
  );
}
