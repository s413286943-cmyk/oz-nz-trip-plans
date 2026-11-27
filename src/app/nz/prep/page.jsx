import PrepList from "@/components/PrepList";
import TripFrame from "@/components/TripFrame";
import nz from "@data/nz.json";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({ title: "澳新 17 天 出发前清单", description: "新西兰参考路线的出发前清单：什么时候订什么、出发前要办的事，可以勾、可以删、可以加。" });

export default function NzPrepPage() {
  return (
    <TripFrame trip="nz" view="prep">
      <PrepList tripId="nz" original={nz} />
    </TripFrame>
  );
}
