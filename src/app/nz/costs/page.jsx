import CostView from "@/components/CostView";
import TripFrame from "@/components/TripFrame";
import costs from "@data/nz-costs.json";
import nz from "@data/nz.json";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({ title: "澳新 17 天 花销", description: "新西兰参考路线的花销：机票、住处、租车、门票和吃喝，按类别和币种分开列。" });

export default function NzCostsPage() {
  return (
    <TripFrame trip="nz" view="costs">
      <CostView costs={costs} lodgings={nz.lodgings} />
    </TripFrame>
  );
}
