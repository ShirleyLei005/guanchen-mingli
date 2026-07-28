"use client";

import { useEffect, useState } from "react";
import type { PlaceMatch, SolarTimeResult } from "../lib/solar-time";

export type ResolvedBirth = {
  gender: "female" | "male";
  calendar: "solar" | "lunar";
  dateTime: string;
  place: PlaceMatch;
  solarTime: SolarTimeResult;
};

function displayTime(value: string) {
  return value ? value.replace("T", " ").slice(0, 16) : "—";
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
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [dateTime, setDateTime] = useState("1992-08-18T08:30");
  const [query, setQuery] = useState(defaultPlace);
  const [place, setPlace] = useState<PlaceMatch | null>(null);
  const [options, setOptions] = useState<PlaceMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [solar, setSolar] = useState<SolarTimeResult | null>(null);

  useEffect(() => {
    if (place || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const data = await response.json() as { results?: PlaceMatch[] };
        setOptions(data.results ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setOptions([]);
      } finally {
        setSearching(false);
      }
    }, 320);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [place, query]);

  useEffect(() => {
    if (!place || !dateTime) return;
    const controller = new AbortController();
    async function run() {
      try {
        const response = await fetch("/api/solar-time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ localDateTime: dateTime, longitude: place!.longitude, timezone: place!.timezone }),
        });
        if (!response.ok) throw new Error("SOLAR_TIME_FAILED");
        const result = await response.json() as SolarTimeResult;
        setSolar(result);
        onChange({ gender, calendar, dateTime, place: place!, solarTime: result });
      } catch (error) {
        if ((error as Error).name !== "AbortError") onChange(null);
      }
    }
    void run();
    return () => controller.abort();
  }, [calendar, dateTime, gender, onChange, place]);

  function resetResolved() {
    setSolar(null);
    onChange(null);
  }

  return (
    <fieldset className="birth-fieldset">
      {label && <legend>{label}</legend>}
      <div className="measure-row">
        <label>性别
          <span className="measure-segmented">
            <button type="button" className={gender === "female" ? "selected" : ""} onClick={() => setGender("female")}>女</button>
            <button type="button" className={gender === "male" ? "selected" : ""} onClick={() => setGender("male")}>男</button>
          </span>
        </label>
        <label>生日类型
          <span className="measure-segmented">
            <button type="button" className={calendar === "solar" ? "selected" : ""} onClick={() => setCalendar("solar")}>阳历</button>
            <button type="button" className={calendar === "lunar" ? "selected" : ""} onClick={() => setCalendar("lunar")}>农历</button>
          </span>
        </label>
      </div>
      <label>{calendar === "solar" ? "阳历出生时间" : "农历日期对应的当地钟表时间"}
        <input type="datetime-local" value={dateTime} onChange={(event) => { resetResolved(); setDateTime(event.target.value); }} />
        {calendar === "lunar" && <small>正式排盘会先校验闰月并换算阳历；当前页面先完成地点和真太阳时校正。</small>}
      </label>
      <label className="measure-place">出生地区
        <input
          value={query}
          onChange={(event) => { resetResolved(); setPlace(null); setOptions([]); setQuery(event.target.value); }}
          placeholder="输入出生城市或区县"
          autoComplete="off"
        />
        {searching && <span className="measure-searching">正在匹配…</span>}
        {options.length > 0 && (
          <div className="measure-place-options">
            {options.map((option) => (
              <button type="button" key={option.id} onClick={() => {
                resetResolved();
                setPlace(option);
                setQuery([option.name, option.admin1, option.country].filter(Boolean).join(" · "));
                setOptions([]);
              }}>
                <span><b>{option.name}</b><small>{[option.admin1, option.country].filter(Boolean).join(" · ")}</small></span>
                <em>{option.latitude.toFixed(4)}°, {option.longitude.toFixed(4)}°</em>
              </button>
            ))}
          </div>
        )}
      </label>
      {place && (
        <div className="measure-solar">
          <div><b>真太阳时校正</b><span>{solar ? "已完成" : "计算中…"}</span></div>
          <p>{place.name} · {place.latitude.toFixed(4)}°, {place.longitude.toFixed(4)}° · {place.timezone}</p>
          {solar && (
            <>
              <section><span><small>钟表时间</small>{displayTime(solar.civilTime)}</span><i>{solar.totalCorrectionMinutes >= 0 ? "+" : ""}{solar.totalCorrectionMinutes} 分钟</i><span><small>真太阳时</small>{displayTime(solar.trueSolarTime)}</span></section>
              <details><summary>查看计算依据</summary><p>标准经线 {solar.standardMeridian}°；经度修正 {solar.longitudeCorrectionMinutes} 分钟；均时差 {solar.equationOfTimeMinutes} 分钟。</p></details>
            </>
          )}
        </div>
      )}
    </fieldset>
  );
}
