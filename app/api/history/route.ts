import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/auth";
import { getStore } from "../../../lib/store";

export async function GET(request: NextRequest) {
  const store = await getStore();
  const user = await getSessionUser(request, store);
  if (!user) return NextResponse.json({ status: "error", message: "请先登录" }, { status: 401 });
  return NextResponse.json({ status: "success", items: await store.listMeasurements(user.id) });
}
