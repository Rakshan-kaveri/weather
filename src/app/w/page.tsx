import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ForecastView } from "@/components/forecast/ForecastView";
import { reverseGeocode } from "@/lib/geo";

type Props = { searchParams: Promise<{ lat?: string; lon?: string; name?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { name } = await searchParams;
  return { title: name ? `${name} weather` : "Forecast" };
}

export default async function PlaceForecastPage({ searchParams }: Props) {
  const sp = await searchParams;
  const lat = Number(sp.lat);
  const lon = Number(sp.lon);
  if (!sp.lat || !sp.lon || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    redirect("/dashboard");
  }
  let name = sp.name?.trim();
  let region: string | undefined;
  let country: string | undefined;
  if (!name) {
    const r = await reverseGeocode(lat, lon);
    name = r.name;
    region = r.region;
    country = r.country;
  }
  return (
    <div className="page">
      <ForecastView loc={{ lat, lon, name: name!, region, country }} />
    </div>
  );
}
