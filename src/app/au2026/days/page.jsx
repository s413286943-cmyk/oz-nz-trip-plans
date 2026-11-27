import TripFrame from "@/components/TripFrame";
import TripPlan from "@/components/TripPlan";
import au2026 from "@data/au2026.json";
import { LIGHT_THEME, pageMeta } from "@/lib/meta";

export const viewport = { themeColor: LIGHT_THEME };

export const metadata = pageMeta({ title: "澳洲 2026 · 改行程", route: "au2026", description: "澳洲参考路线的可改版本：改每天的安排、加减天数，改动只存在这台设备上。" });

export default function Au2026DaysPage() {
  return (
    <TripFrame trip="au2026" view="schedule">
      <TripPlan
        tripId="au2026"
        original={au2026}
        intro="这 16 天每天去哪、怎么走。点“开始改”就能改，改过的样子也会显示在“行程”页。"
      />
    </TripFrame>
  );
}
