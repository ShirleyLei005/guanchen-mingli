import { NextRequest, NextResponse } from "next/server";
import { generateZiweiChart } from "../../../../lib/chart-engines";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    trueSolarTime?: string;
    gender?: "female" | "male";
    topics?: string[];
  } | null;
  if (!body?.trueSolarTime || !["female", "male"].includes(body.gender ?? "") || !Array.isArray(body.topics)) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  try {
    return NextResponse.json(generateZiweiChart({
      trueSolarTime: body.trueSolarTime,
      gender: body.gender!,
      topics: body.topics.slice(0, 3),
    }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ZIWEI_CALCULATION_FAILED" },
      { status: 500 },
    );
  }
}
