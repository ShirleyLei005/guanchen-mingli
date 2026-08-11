import { NextRequest, NextResponse } from "next/server";
import { COMMON_CHINA_PLACES, type PlaceMatch } from "../../../lib/solar-time";

type OpenMeteoResult = {
  id: number;
  name: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  admin4?: string;
  country?: string;
  country_code?: string;
  feature_code?: string;
  population?: number;
  latitude: number;
  longitude: number;
  timezone?: string;
};

type ArcGisCandidate = {
  address: string;
  score: number;
  location: { x: number; y: number };
  attributes: { Match_addr?: string; Addr_type?: string; District?: string; City?: string; Subregion?: string; Region?: string; Country?: string; CntryName?: string };
};

function normalizePlaceText(value: string) {
  return value.normalize("NFKC")
    .replace(/(?:特别行政区|自治区|自治州|地区|省|市|区|县|盟)(?=$|[\s,，/·._-])/g, "")
    .replace(/[\s,，/·._-]/g, "")
    .toLowerCase();
}

function queryParts(query: string) {
  const marked = query
    .replace(/(特别行政区|自治区|自治州|地区|省|市|区|县|盟)/g, "$1|")
    .split(/[|,，/·]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
  return [...new Set(marked.flatMap((item) => item.startsWith("中国") && item.length > 2 ? ["中国", item.slice(2)] : [item]))];
}

function placePath(place: PlaceMatch) {
  return [place.name, place.admin4, place.admin3, place.admin2, place.admin1, place.country].filter(Boolean).join(" ");
}

function relevance(place: PlaceMatch, query: string) {
  const target = normalizePlaceText(placePath(place));
  const whole = normalizePlaceText(query);
  const parts = queryParts(query).map(normalizePlaceText);
  let score = parts.reduce((sum, part) => sum + (target.includes(part) ? 25 : -8), 0);
  if (normalizePlaceText(place.name) === normalizePlaceText(parts.at(-1) || query)) score += 80;
  if (target.includes(whole)) score += 120;
  if (place.source === "local") score += 8;
  return score;
}

function matchesRequestedPlace(place: PlaceMatch, query: string) {
  const normalizedQuery = normalizePlaceText(query);
  const normalizedName = normalizePlaceText(place.name);
  const target = normalizePlaceText(placePath(place));
  const lastPart = normalizePlaceText(queryParts(query).at(-1) || query);
  return normalizedQuery.includes(normalizedName) || target.includes(normalizedQuery) || (lastPart.length >= 2 && target.includes(lastPart));
}

function semanticPlaceKey(place: PlaceMatch) {
  const region = normalizePlaceText(place.admin1 || place.countryCode || place.country || "");
  return `${region}:${normalizePlaceText(place.name)}`;
}

function sourcePriority(place: PlaceMatch) {
  return place.source === "local" ? 3 : place.source === "arcgis" ? 2 : 1;
}

export function dedupePlaceMatches(places: PlaceMatch[], query: string) {
  const bestByPlace = new Map<string, PlaceMatch>();
  for (const place of places.filter((item) => matchesRequestedPlace(item, query))) {
    const key = semanticPlaceKey(place);
    const current = bestByPlace.get(key);
    if (!current || sourcePriority(place) > sourcePriority(current) || (sourcePriority(place) === sourcePriority(current) && relevance(place, query) > relevance(current, query))) {
      bestByPlace.set(key, place);
    }
  }
  return [...bestByPlace.values()].sort((left, right) => relevance(right, query) - relevance(left, query));
}

async function searchOpenMeteo(name: string) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "20");
  url.searchParams.set("language", "zh");
  url.searchParams.set("format", "json");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return [];
  const data = await response.json() as { results?: OpenMeteoResult[] };
  return (data.results ?? []).filter((item) => item.timezone && Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
}

async function searchArcGis(query: string): Promise<PlaceMatch[]> {
  const url = new URL("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates");
  url.searchParams.set("SingleLine", query);
  url.searchParams.set("outFields", "Match_addr,Addr_type,District,City,Subregion,Region,Country,CntryName");
  url.searchParams.set("maxLocations", "8");
  url.searchParams.set("forStorage", "false");
  url.searchParams.set("f", "json");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return [];
  const data = await response.json() as { candidates?: ArcGisCandidate[] };
  return (data.candidates ?? []).filter((item) => item.score >= 75).map((item, index) => {
    const attr = item.attributes;
    const countryCode = attr.Country || "";
    const name = attr.District || attr.City || attr.Subregion || item.address.split(/[，,]/)[0];
    return {
      id: `esri-${item.location.x}-${item.location.y}-${index}`,
      name,
      admin1: attr.Region,
      admin2: attr.Subregion,
      admin3: attr.City,
      admin4: attr.District,
      country: attr.CntryName || ({ CHN: "中国", FRA: "法国" } as Record<string, string>)[countryCode] || countryCode,
      countryCode,
      featureCode: attr.Addr_type,
      latitude: item.location.y,
      longitude: item.location.x,
      timezone: countryCode === "CHN" ? "Asia/Shanghai" : "UTC",
      source: "arcgis" as const,
    };
  });
}

async function resolveTimezone(place: PlaceMatch) {
  if (place.timezone !== "UTC") return place;
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(place.latitude));
    url.searchParams.set("longitude", String(place.longitude));
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("current", "temperature_2m");
    const response = await fetch(url);
    const data = await response.json() as { timezone?: string };
    return data.timezone ? { ...place, timezone: data.timezone } : place;
  } catch {
    return place;
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 80) {
    return NextResponse.json({ results: [], error: "QUERY_LENGTH" }, { status: 400 });
  }

  const normalized = normalizePlaceText(query);
  const local = COMMON_CHINA_PLACES.filter((place) => {
    const haystack = normalizePlaceText(placePath(place));
    return haystack.includes(normalized) || normalized.includes(normalizePlaceText(place.name));
  });

  let remote: PlaceMatch[] = [];
  try {
    const parts = queryParts(query);
    const searchTerms = [...new Set([query, parts.at(-1)].filter((item): item is string => Boolean(item)))].slice(0, 2);
    const [openMeteoResults, arcGisResults] = await Promise.all([
      Promise.all(searchTerms.map(searchOpenMeteo)).then((items) => items.flat()),
      searchArcGis(query),
    ]);
    remote = [...openMeteoResults.map((item) => ({
        id: `om-${item.id}`,
        name: item.name,
        admin1: item.admin1,
        admin2: item.admin2,
        admin3: item.admin3,
        admin4: item.admin4,
        country: item.country ?? "",
        countryCode: item.country_code,
        featureCode: item.feature_code,
        latitude: item.latitude,
        longitude: item.longitude,
        timezone: item.timezone!,
        source: "open-meteo",
      } as PlaceMatch)), ...arcGisResults];
  } catch {
    // The curated local list remains available when the external provider is unavailable.
  }

  const merged = dedupePlaceMatches([...local, ...remote], query).slice(0, 12);
  const resolved = await Promise.all(merged.map(resolveTimezone));

  return NextResponse.json(
    { results: resolved, attribution: "全球地名与行政区数据：Open-Meteo / GeoNames 与 Esri World Geocoder；坐标为所选城市或区县中心点" },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
