import PrepList from "@/components/PrepList";
import TripFrame from "@/components/TripFrame";
import places from "@data/places.json";
import { EMPTY_PLAN } from "@/lib/routes";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({ title: "出发前清单", description: "这台设备上排好的方案的出发前清单。", personal: true });

export default function MinePrepPage() {
  return (
    <TripFrame trip="mine" view="prep">
      <PrepList tripId="mine" original={EMPTY_PLAN} library={places} />
    </TripFrame>
  );
}
