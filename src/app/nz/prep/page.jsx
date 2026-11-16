import PrepList from "@/components/PrepList";
import TripFrame from "@/components/TripFrame";
import nz from "@data/nz.json";

export const metadata = { title: "澳新 17 天 出发前清单" };

export default function NzPrepPage() {
  return (
    <TripFrame trip="nz" view="prep">
      <PrepList tripId="nz" todos={nz.todos} />
    </TripFrame>
  );
}
