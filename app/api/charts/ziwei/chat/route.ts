import { NextRequest, NextResponse } from "next/server";
import { callZiweiQuestion } from "../../../../../lib/ziwei-mcp-tools";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { chartId?: string; question?: string } | null;
  if (!body?.chartId || !body.question?.trim()) {
    return NextResponse.json({ status: "error", message: "缺少 chartId 或问题内容" }, { status: 400 });
  }
  try {
    return NextResponse.json(await callZiweiQuestion({
      chartId: body.chartId,
      question: body.question.trim().slice(0, 500),
    }));
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "命盘分析失败" },
      { status: 500 },
    );
  }
}
