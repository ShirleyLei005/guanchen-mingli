import type { Metadata } from "next";
import { MeasurementPage } from "../measurement-page";

export const metadata: Metadata = {
  title: "八字测算 · 观辰",
  description: "填写出生时间与地点，自动校正真太阳时，建立八字命盘并选择事业、财富、感情等专题。",
};

export default function BaziPage() {
  return <MeasurementPage kind="bazi" />;
}
