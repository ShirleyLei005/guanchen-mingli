import { NextResponse } from "next/server";
import { BAZI_ALGORITHM_VERSION, ZIWEI_ALGORITHM_VERSION } from "../../../lib/chart-engine";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "guanchen",
    algorithms: {
      bazi: BAZI_ALGORITHM_VERSION,
      ziwei: ZIWEI_ALGORITHM_VERSION,
    },
    payments: "sandbox",
  });
}
