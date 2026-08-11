"use client";

import { useEffect, useState } from "react";
import type { PlaceMatch, SolarTimeResult } from "../lib/solar-time";
import { GuanchenWait } from "./guanchen-wait";
import { PlaceHierarchyPicker } from "./place-hierarchy-picker";

export type ResolvedBirth = {
  name: string;
  gender: "female" | "male";
  calendar: "solar" | "lunar";
  isLeapMonth: boolean;
  dateTime: string;
  place: PlaceMatch;
  solarTime: SolarTimeResult;
};

function displayTime(value: string) {
  return value ? value.replace("T", " ").slice(0, 16) : "—";
}

function displayPlace(place: PlaceMatch) {
  return [place.country, place.admin1, place.admin2, place.admin3, place.admin4, place.name]
    .filter((item, index, all): item is string => Boolean(item) && all.indexOf(item) === index)
    .join(" · ");
}

export function BirthFields({
  label,
  defaultPlace = "昆明",
  onChange,
}: {
  label?: string;
  defaultPlace?: string;
  onChange: (value: ResolvedBirth | null) => void;
}) {
  const [gender, setGender] = useState<"female" | "male">("female");
  const [personName, setPersonName] = useState("");
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [dateTime, setDateTime] = useState("1992-08-18T08:30");
  const [place, setPlace] = useState<PlaceMatch | null>(null);
  const [solar, setSolar] = useState<SolarTimeResult | null>(null);

  useEffect(() => {
    if (!place || !dateTime) return;
    const controller = new AbortController();
    async function run() {
      try {
        const response = await fetch("/api/solar-time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            localDateTime: dateTime,
            longitude: place!.longitude,
            timezone: place!.timezone,
            calendar,
            isLeapMonth,
          }),
        });
        if (!response.ok) throw new Error("SOLAR_TIME_FAILED");
        const result = await response.json() as SolarTimeResult;
        setSolar(result);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSolar(null);
          onChange(null);
        }
      }
    }
    void run();
    return () => controller.abort();
  }, [calendar, dateTime, isLeapMonth, onChange, place]);

  useEffect(() => {
    if (!place || !solar) return;
    onChange({ name: personName.trim(), gender, calendar, isLeapMonth, dateTime, place, solarTime: solar });
  }, [calendar, dateTime, gender, isLeapMonth, onChange, personName, place, solar]);

  function resetResolved() {
    setSolar(null);
    onChange(null);
  }

  return (
    <fieldset className="birth-fieldset">
      {label && <legend>{label}</legend>}
      <label>姓名
        <input
          type="text"
          value={personName}
          onChange={(event) => setPersonName(event.target.value.slice(0, 30))}
          placeholder="请输入姓名或常用称呼"
          autoComplete="name"
          maxLength={30}
        />
      </label>
      <div className="measure-row">
        <label>性别
          <span className="measure-segmented">
            <button type="button" className={gender === "female" ? "selected" : ""} onClick={() => setGender("female")}>女</button>
            <button type="button" className={gender === "male" ? "selected" : ""} onClick={() => setGender("male")}>男</button>
          </span>
        </label>
        <label>生日类型
          <span className="measure-segmented">
            <button type="button" className={calendar === "solar" ? "selected" : ""} onClick={() => { resetResolved(); setCalendar("solar"); setIsLeapMonth(false); }}>阳历</button>
            <button type="button" className={calendar === "lunar" ? "selected" : ""} onClick={() => { resetResolved(); setCalendar("lunar"); }}>农历</button>
          </span>
        </label>
      </div>
      <label>{calendar === "solar" ? "阳历出生时间" : "农历日期对应的当地钟表时间"}
        <input type="datetime-local" value={dateTime} onChange={(event) => { resetResolved(); setDateTime(event.target.value); }} />
        {calendar === "lunar" && (
          <>
            <small>系统会先把农历日期换算为阳历，再按出生地经纬度校正真太阳时。</small>
            <span className="lunar-leap">
              <input type="checkbox" checked={isLeapMonth} onChange={(event) => { resetResolved(); setIsLeapMonth(event.target.checked); }} />
              这是闰月
            </span>
          </>
        )}
      </label>
      <PlaceHierarchyPicker defaultCity={defaultPlace} onChange={(nextPlace) => { resetResolved(); setPlace(nextPlace); }} />
      {place && (
        <div className="measure-solar">
          <div><b>真太阳时校正</b><span>{solar ? "已完成" : "计算中…"}</span></div>
          <p>{displayPlace(place)} · {place.latitude.toFixed(4)}°, {place.longitude.toFixed(4)}° · {place.timezone}</p>
          {solar && (
            <>
              {calendar === "lunar" && <p>农历已换算为阳历：{displayTime(solar.normalizedSolarDateTime)}</p>}
              <section><span><small>钟表时间</small>{displayTime(solar.civilTime)}</span><i>{solar.totalCorrectionMinutes >= 0 ? "+" : ""}{solar.totalCorrectionMinutes} 分钟</i><span><small>真太阳时</small>{displayTime(solar.trueSolarTime)}</span></section>
              <details><summary>查看计算依据</summary><p>标准经线 {solar.standardMeridian}°；经度修正 {solar.longitudeCorrectionMinutes} 分钟；均时差 {solar.equationOfTimeMinutes} 分钟。</p></details>
            </>
          )}
        </div>
      )}
      <GuanchenWait active={Boolean(place && !solar)} title="小道士正在校正出生时间" detail="正在根据经纬度、历史时区与均时差计算真太阳时。" estimatedSeconds={6} compact />
    </fieldset>
  );
}
