import TripFrame from "@/components/TripFrame";
import TripPlan from "@/components/TripPlan";
import nz2027 from "@data/nz2027.json";

export const metadata = { title: "澳新 2027 行程" };

export default function Nz2027Page() {
  return (
    <TripFrame trip="nz2027" view="schedule">
      <TripPlan
        tripId="nz2027"
        original={nz2027}
        intro="悉尼 3 晚，基督城取车自驾南岛到皇后镇，再飞奥克兰。可做可不做的标了“可加”，二选一的标了会错过什么。"
      />
    </TripFrame>
  );
}
