import TripFrame from "@/components/TripFrame";
import TripPlan from "@/components/TripPlan";
import au2026 from "@data/au2026.json";

export const metadata = { title: "澳洲 2026 每日行程" };

export default function Au2026DaysPage() {
  return (
    <TripFrame trip="au2026" view="schedule">
      <TripPlan
        tripId="au2026"
        original={au2026}
        intro="出发前排的每日行程，和“自驾攻略”里实际走下来的经验对照着看。"
      />
    </TripFrame>
  );
}
