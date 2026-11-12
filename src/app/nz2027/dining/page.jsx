import DiningView from "@/components/DiningView";
import TripFrame from "@/components/TripFrame";
import nz2027 from "@data/nz2027.json";

export const metadata = { title: "澳新 2027 吃什么" };

export default function Nz2027DiningPage() {
  return (
    <TripFrame trip="nz2027" view="dining">
      <DiningView tripId="nz2027" original={nz2027} />
    </TripFrame>
  );
}
