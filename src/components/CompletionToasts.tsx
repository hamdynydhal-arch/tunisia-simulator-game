"use client";

import { useGameStore } from "@/store/gameStore";
import { getProjectTemplate } from "@/data/projects";
import { REGION_POINTS } from "@/lib/regionPoints";
import { flyToRegion } from "@/lib/mapBus";

/**
 * Stack of "project completed" notifications with a Go-to-Region action
 * that flies the camera to the governorate and opens its panel.
 * Positioned at inline-end (physical left in RTL), over the map and away
 * from the sidebar.
 */
export default function CompletionToasts() {
  const notices = useGameStore((state) => state.completionNotices);
  const dismissNotice = useGameStore((state) => state.dismissNotice);
  const regions = useGameStore((state) => state.regions);
  const selectRegion = useGameStore((state) => state.selectRegion);

  if (notices.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 end-6 z-30 flex w-80 max-w-[calc(100vw-3rem)] flex-col gap-2 max-md:bottom-24">
      {notices.map((notice) => {
        const template = getProjectTemplate(notice.projectId);
        const region = regions[notice.regionId];
        return (
          <div
            key={notice.instanceId}
            role="status"
            className="animate-slide-in-up rounded-xl border border-emerald-500/40 bg-slate-900/95 p-3 shadow-2xl backdrop-blur"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-emerald-300">
                🎉 اكتمل المشروع
              </p>
              <button
                type="button"
                onClick={() => dismissNotice(notice.instanceId)}
                aria-label="إغلاق الإشعار"
                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
              >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                  <path d="M4.3 4.3a1 1 0 0 1 1.4 0L10 8.6l4.3-4.3a1 1 0 1 1 1.4 1.4L11.4 10l4.3 4.3a1 1 0 0 1-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 0 1-1.4-1.4L8.6 10 4.3 5.7a1 1 0 0 1 0-1.4Z" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-200">
              {template?.name ?? notice.projectId}
              <span className="text-slate-400"> — ولاية {region.name}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                selectRegion(notice.regionId);
                flyToRegion(REGION_POINTS[notice.regionId]);
                dismissNotice(notice.instanceId);
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-emerald-500"
            >
              اذهب إلى الولاية
              <span aria-hidden="true">←</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
