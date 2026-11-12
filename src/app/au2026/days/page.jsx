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
        intro="出发前排的每日路书。点“开始改”改成你自己的，“行程+总结”页也会跟着显示你的版本。"
      />
    </TripFrame>
  );
}
