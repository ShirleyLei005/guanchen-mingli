import type { Metadata } from "next";
import { MeasurementPage } from "../measurement-page";

export const metadata: Metadata = {
  title: "紫微斗数测算 · 观辰",
  description: "通过命宫、身宫、十二宫、主星与四化，理解人生领域和阶段课题。",
};

export default function ZiweiPage() {
  return <MeasurementPage kind="ziwei" />;
}
