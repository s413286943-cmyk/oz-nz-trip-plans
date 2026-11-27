import AtlasTrip from "@/components/AtlasTrip";
import TripFrame from "@/components/TripFrame";
import retro from "@data/au2026-retro.json";
import au2026 from "@data/au2026.json";
import { LIGHT_THEME, pageMeta } from "@/lib/meta";

export const viewport = { themeColor: LIGHT_THEME };

export const metadata = pageMeta({ title: "澳洲 2026 行程", route: "au2026", description: "澳洲参考路线：墨尔本进、悉尼出的 16 天，大洋路、凯恩斯高原和悉尼南海岸自驾，每天的安排都附了经验。" });

export default function Au2026Page() {
  return (
    <TripFrame trip="au2026" view="atlas" wide>
      <AtlasTrip original={au2026} retro={retro} />
    </TripFrame>
  );
}
