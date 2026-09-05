import type { MetadataRoute } from "next";
import { SAKAN_CAMOUFLAGE_NAME } from "@/lib/sakan/camouflage";

// Required for `output: "export"`: the manifest route must be prerendered.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SAKAN_CAMOUFLAGE_NAME,
    short_name: SAKAN_CAMOUFLAGE_NAME,
    description:
      "لعبة استراتيجية شاملة تدور أحداثها في ولايات تونس الأربع والعشرين.",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
      {
        src: "/logo.svg?v=sovereign_1",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/logo.svg?v=sovereign_1",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
