import TripFrame from "@/components/TripFrame";
import TripPlan from "@/components/TripPlan";
import nz from "@data/nz.json";

export const metadata = { title: "澳新 17 天 行程" };

export default function NzPage() {
  return (
    <TripFrame trip="nz" view="schedule">
      <TripPlan
        tripId="nz"
        original={nz}
        intro="悉尼 3 晚，基督城取车自驾南岛到皇后镇，再飞奥克兰。可做可不做的标了“可加”，二选一的标了会错过什么。"
      />
    </TripFrame>
  );
}
