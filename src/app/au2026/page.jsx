import AtlasTrip from "@/components/AtlasTrip";
import TripFrame from "@/components/TripFrame";
import retro from "@data/au2026-retro.json";
import au2026 from "@data/au2026.json";

export const metadata = { title: "澳洲 2026 · 行程和走完回来的总结" };

export default function Au2026Page() {
  return (
    <TripFrame trip="au2026" view="atlas" wide>
      <AtlasTrip original={au2026} retro={retro} />
    </TripFrame>
  );
}
