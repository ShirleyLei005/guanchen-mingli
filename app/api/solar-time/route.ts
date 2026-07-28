import { NextRequest, NextResponse } from "next/server";
import { calculateTrueSolarTime } from "../../../lib/solar-time";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    localDateTime?: string;
    longitude?: number;
    timezone?: string;
  } | null;

  if (!body?.localDateTime || typeof body.longitude !== "number" || !body.timezone) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    return NextResponse.json(calculateTrueSolarTime({
      localDateTime: body.localDateTime,
      longitude: body.longitude,
      timezone: body.timezone,
    }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CALCULATION_FAILED" },
      { status: 400 },
    );
  }
}
