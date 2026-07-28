import { MingliApp } from "./mingli-app";

export const metadata = {
  title: "观辰 · 读懂命盘，不把人生交给命盘",
  description: "自动匹配出生地经纬度与历史时区，校正真太阳时，从八字与紫微斗数中看见趋势、课题和选择。",
};

export default function Home() {
  return <MingliApp />;
}
