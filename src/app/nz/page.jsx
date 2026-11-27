import TripFrame from "@/components/TripFrame";
import TripPlan from "@/components/TripPlan";
import overview from "@data/nz-overview.json";
import nz from "@data/nz.json";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({ title: "澳新 17 天 行程", description: "新西兰参考路线：悉尼 3 晚、新西兰南岛自驾再到奥克兰，17 天每天去哪、住哪、吃什么，附路线图和每天开车多久。" });

export default function NzPage() {
  return (
    <TripFrame trip="nz" view="schedule">
      <TripPlan
        tripId="nz"
        original={nz}
        overview={overview}
        intro="悉尼 3 晚，基督城取车自驾南岛到皇后镇，再飞奥克兰。可做可不做的标了“可加”，二选一的标了会错过什么。"
      />
    </TripFrame>
  );
}
