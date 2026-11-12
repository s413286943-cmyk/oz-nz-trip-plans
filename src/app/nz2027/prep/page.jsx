import PrepList from "@/components/PrepList";
import TripFrame from "@/components/TripFrame";
import nz2027 from "@data/nz2027.json";

export const metadata = { title: "澳新 2027 出发前清单" };

export default function Nz2027PrepPage() {
  return (
    <TripFrame trip="nz2027" view="prep">
      <PrepList tripId="nz2027" todos={nz2027.todos} />
    </TripFrame>
  );
}
