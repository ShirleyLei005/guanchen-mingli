import { NextRequest, NextResponse } from "next/server";
import { LunarHour } from "tyme4ts";
import { calculateTrueSolarTime } from "../../../lib/solar-time";

function lunarToSolarDateTime(value: string, isLeapMonth: boolean) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error("INVALID_LUNAR_TIME");
  const [, year, month, day, hour, minute, second = "0"] = match;
  const solar = LunarHour.fromYmdHms(
    Number(year),
    (isLeapMonth ? -1 : 1) * Number(month),
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ).getSolarTime();
  const pad = (item: number) => String(item).padStart(2, "0");
  return `${solar.getYear()}-${pad(solar.getMonth())}-${pad(solar.getDay())}T${pad(solar.getHour())}:${pad(solar.getMinute())}:${pad(solar.getSecond())}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    localDateTime?: string;
    longitude?: number;
    timezone?: string;
    calendar?: "solar" | "lunar";
    isLeapMonth?: boolean;
  } | null;

  if (!body?.localDateTime || typeof body.longitude !== "number" || !body.timezone) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    const calendar = body.calendar ?? "solar";
    const normalizedSolarDateTime = calendar === "lunar"
      ? lunarToSolarDateTime(body.localDateTime, Boolean(body.isLeapMonth))
      : body.localDateTime;
    return NextResponse.json(calculateTrueSolarTime({
      localDateTime: normalizedSolarDateTime,
      longitude: body.longitude,
      timezone: body.timezone,
      inputCalendar: calendar,
      normalizedSolarDateTime,
      isLeapMonth: Boolean(body.isLeapMonth),
    }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CALCULATION_FAILED" },
      { status: 400 },
    );
  }
}
