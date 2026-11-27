import DiningView from "@/components/DiningView";
import TripFrame from "@/components/TripFrame";
import nz from "@data/nz.json";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({ title: "澳新 17 天 吃什么", description: "新西兰参考路线每天吃什么：要提前订的餐厅和每天的早午晚。" });

export default function NzDiningPage() {
  return (
    <TripFrame trip="nz" view="dining">
      <DiningView tripId="nz" original={nz} />
    </TripFrame>
  );
}
