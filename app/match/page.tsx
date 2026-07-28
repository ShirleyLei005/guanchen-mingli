import type { Metadata } from "next";
import { MeasurementPage } from "../measurement-page";

export const metadata: Metadata = {
  title: "合盘测算 · 观辰",
  description: "分别校正双方出生时间，理解关系中的互补、摩擦、压力应对与共同成长。",
};

export default function MatchPage() {
  return <MeasurementPage kind="match" />;
}
