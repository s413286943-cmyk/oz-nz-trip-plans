import CostView from "@/components/CostView";
import TripFrame from "@/components/TripFrame";
import costs from "@data/nz2027-costs.json";
import nz2027 from "@data/nz2027.json";

export const metadata = { title: "澳新 2027 花销" };

export default function Nz2027CostsPage() {
  return (
    <TripFrame trip="nz2027" view="costs">
      <CostView costs={costs} lodgings={nz2027.lodgings} />
    </TripFrame>
  );
}
