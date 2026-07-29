import { NextRequest, NextResponse } from "next/server";
import { runZiweiWorkflow } from "../../../../lib/ziwei-mcp-tools";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    trueSolarTime?: string;
    gender?: "female" | "male";
    topics?: string[];
    calendar?: "solar" | "lunar";
    timezone?: string;
    location?: {
      province?: string;
      city?: string;
      longitude?: number;
      latitude?: number;
    };
  } | null;
  if (!body?.trueSolarTime || !["female", "male"].includes(body.gender ?? "") || !Array.isArray(body.topics)) {
    return NextResponse.json({ status: "error", message: "出生时间、性别或分析方向无效" }, { status: 400 });
  }
  try {
    return NextResponse.json(await runZiweiWorkflow({
      birthDate: body.trueSolarTime.slice(0, 10),
      birthTime: body.trueSolarTime.slice(11, 16),
      trueSolarTime: body.trueSolarTime,
      gender: body.gender!,
      topics: body.topics.slice(0, 3),
      calendar: body.calendar ?? "solar",
      timezone: body.timezone ?? "Asia/Shanghai",
      location: body.location ?? {
        province: "北京市",
        city: "北京市",
        longitude: 116.4,
        latitude: 39.9,
      },
    }));
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "紫微命盘生成失败" },
      { status: 500 },
    );
  }
}
