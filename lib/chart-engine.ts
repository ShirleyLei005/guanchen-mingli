export const BAZI_ALGORITHM_VERSION = "lunar-python-adapter/1.0";
export const ZIWEI_ALGORITHM_VERSION = "iztro/2.5.8";

export type BirthInput = {
  calendarType: "solar" | "lunar";
  birthDateTime: string;
  gender: "male" | "female";
  placeName: string;
  timezone: string;
  trueSolarTime: boolean;
};

export function normalizeBirthInput(input: BirthInput) {
  if (!input.birthDateTime || Number.isNaN(Date.parse(input.birthDateTime))) throw new Error("INVALID_BIRTH_TIME");
  if (!input.placeName.trim()) throw new Error("PLACE_REQUIRED");
  return {
    ...input,
    placeName: input.placeName.trim(),
    normalizedAt: new Date(input.birthDateTime).toISOString(),
  };
}

export async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// The production adapter invokes lunar-python in the Django calculation service.
// This deterministic preview remains intentionally labelled and never feeds paid AI reports.
export function buildPreviewPillars(input: BirthInput) {
  const normalized = normalizeBirthInput(input);
  const seed = [...normalized.birthDateTime, ...normalized.gender].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const stems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  return {
    previewOnly: true,
    algorithmVersion: "browser-preview/1.0",
    pillars: Array.from({ length: 4 }, (_, index) => ({
      stem: stems[(seed + index * 3) % 10],
      branch: branches[(seed + index * 5) % 12],
    })),
  };
}
