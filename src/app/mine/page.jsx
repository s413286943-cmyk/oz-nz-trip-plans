import TripFrame from "@/components/TripFrame";
import TripPlan from "@/components/TripPlan";
import places from "@data/places.json";
import { EMPTY_PLAN } from "@/lib/routes";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({ title: "方案", description: "这台设备上排好的方案。", personal: true });

export default function MinePage() {
  return (
    <TripFrame trip="mine" view="schedule">
      <TripPlan tripId="mine" original={EMPTY_PLAN} library={places} own intro="" />
    </TripFrame>
  );
}
