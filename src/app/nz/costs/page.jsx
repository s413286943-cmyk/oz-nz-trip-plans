import CostView from "@/components/CostView";
import TripFrame from "@/components/TripFrame";
import costs from "@data/nz-costs.json";
import nz from "@data/nz.json";

export const metadata = { title: "澳新 17 天 花销" };

export default function NzCostsPage() {
  return (
    <TripFrame trip="nz" view="costs">
      <CostView costs={costs} lodgings={nz.lodgings} />
    </TripFrame>
  );
}
