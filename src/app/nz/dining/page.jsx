import DiningView from "@/components/DiningView";
import TripFrame from "@/components/TripFrame";
import nz from "@data/nz.json";

export const metadata = { title: "澳新 17 天 吃什么" };

export default function NzDiningPage() {
  return (
    <TripFrame trip="nz" view="dining">
      <DiningView tripId="nz" original={nz} />
    </TripFrame>
  );
}
