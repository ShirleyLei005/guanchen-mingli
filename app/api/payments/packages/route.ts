import { NextRequest, NextResponse } from "next/server";
import { getStore } from "../../../../lib/store";

export async function GET(request: NextRequest) {
  const store = await getStore();
  const packages = await store.getCreditPackages();
  return NextResponse.json({ packages });
}
