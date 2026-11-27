import BudgetView from "@/components/BudgetView";
import TripFrame from "@/components/TripFrame";
import places from "@data/places.json";
import { EMPTY_PLAN } from "@/lib/routes";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({ title: "预算", description: "这台设备上排好的方案的预算。", personal: true });

export default function MineBudgetPage() {
  return (
    <TripFrame trip="mine" view="costs">
      <BudgetView original={EMPTY_PLAN} library={places} />
    </TripFrame>
  );
}
