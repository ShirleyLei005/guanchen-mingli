import { NextRequest, NextResponse } from "next/server";
import { COMMON_CHINA_PLACES, type PlaceMatch } from "../../../lib/solar-time";

type OpenMeteoResult = {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) {
    return NextResponse.json({ results: [], error: "QUERY_LENGTH" }, { status: 400 });
  }

  const normalized = query.replace(/[省市区县\s]/g, "").toLowerCase();
  const local = COMMON_CHINA_PLACES.filter((place) => {
    const haystack = `${place.name}${place.admin1 ?? ""}${place.country}`.replace(/[省市区县\s]/g, "").toLowerCase();
    return haystack.includes(normalized) || normalized.includes(place.name.replace(/[省市区县\s]/g, "").toLowerCase());
  });

  let remote: PlaceMatch[] = [];
  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", query);
    url.searchParams.set("count", "6");
    url.searchParams.set("language", "zh");
    url.searchParams.set("format", "json");
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (response.ok) {
      const data = await response.json() as { results?: OpenMeteoResult[] };
      remote = (data.results ?? []).filter((item) => item.timezone).map((item) => ({
        id: `om-${item.id}`,
        name: item.name,
        admin1: item.admin1,
        country: item.country ?? "",
        latitude: item.latitude,
        longitude: item.longitude,
        timezone: item.timezone!,
        source: "open-meteo",
      }));
    }
  } catch {
    // The curated local list remains available when the external provider is unavailable.
  }

  const merged = [...local, ...remote].filter((place, index, all) =>
    all.findIndex((candidate) =>
      Math.abs(candidate.latitude - place.latitude) < 0.02
      && Math.abs(candidate.longitude - place.longitude) < 0.02
    ) === index
  ).slice(0, 8);

  return NextResponse.json(
    { results: merged, attribution: "地名数据：Open-Meteo / GeoNames；常用城市采用内置校验坐标" },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
