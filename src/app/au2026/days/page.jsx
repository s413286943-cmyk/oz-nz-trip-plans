import TripFrame from "@/components/TripFrame";
import TripPlan from "@/components/TripPlan";
import au2026 from "@data/au2026.json";

export const metadata = { title: "澳洲 2026 · 改成你的" };

export default function Au2026DaysPage() {
  return (
    <TripFrame trip="au2026" view="schedule">
      <TripPlan
        tripId="au2026"
        original={au2026}
        intro="这 16 天每天去哪、怎么走。点“开始改”改成你自己的，“行程”页也会显示你改过的样子。"
      />
    </TripFrame>
  );
}
