import type { Metadata } from "next";
import { MeasurementPage } from "../measurement-page";

export const metadata: Metadata = {
  title: "命盘问答 · 观辰",
  description: "围绕固定命盘连续追问事业、感情、关系与现实选择。",
};

export default function ChatPage() {
  return <MeasurementPage kind="chat" />;
}
