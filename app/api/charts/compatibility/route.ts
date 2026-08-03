import { NextResponse } from "next/server";
import { generateCompatibility, type CompatibilityMode } from "../../../../lib/chart-engines";
import { AiReportError, generateDeepReport } from "../../../../lib/ai-report";

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
      notes?: string;
      deepReport?: boolean;
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
    if (body.deepReport) result.aiReport = await generateDeepReport({
      kind: "compatibility",
      chart: result,
      topics: (body.topics ?? []).slice(0, 3),
      question: body.notes?.slice(0, 500),
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof AiReportError ? error.code : "COMPATIBILITY_FAILED",
        message: error instanceof Error ? error.message : "合盘或报告生成失败",
      },
      { status: error instanceof AiReportError ? 502 : 500 },
    );
  }
}
