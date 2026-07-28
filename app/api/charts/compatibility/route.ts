import { NextResponse } from "next/server";
import { generateCompatibility, type CompatibilityMode } from "../../../../lib/chart-engines";

type BirthPayload = {
  trueSolarTime?: string;
  gender?: "female" | "male";
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      mode?: CompatibilityMode;
      first?: BirthPayload;
      second?: BirthPayload;
      topics?: string[];
    };
    if (!body.first?.trueSolarTime || !body.second?.trueSolarTime) {
      return NextResponse.json({ error: "MISSING_BIRTH_DATA" }, { status: 400 });
    }
    const mode: CompatibilityMode = body.mode === "ziwei" ? "ziwei" : "bazi";
    const result = await generateCompatibility({
      mode,
      first: {
        trueSolarTime: body.first.trueSolarTime,
        gender: body.first.gender === "male" ? "male" : "female",
        topics: body.topics ?? [],
      },
      second: {
        trueSolarTime: body.second.trueSolarTime,
        gender: body.second.gender === "male" ? "male" : "female",
        topics: body.topics ?? [],
      },
      topics: body.topics ?? [],
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "COMPATIBILITY_FAILED" }, { status: 500 });
  }
}
