"use client";

import { useEffect, useId, useState } from "react";
import type { PlaceMatch } from "../lib/solar-time";

const COUNTRIES = ["中国", "中国香港", "中国澳门", "中国台湾", "日本", "韩国", "新加坡", "马来西亚", "泰国", "美国", "加拿大", "英国", "法国", "德国", "澳大利亚", "新西兰"];
const CHINA_PROVINCES = ["北京市", "天津市", "河北省", "山西省", "内蒙古自治区", "辽宁省", "吉林省", "黑龙江省", "上海市", "江苏省", "浙江省", "安徽省", "福建省", "江西省", "山东省", "河南省", "湖北省", "湖南省", "广东省", "广西壮族自治区", "海南省", "重庆市", "四川省", "贵州省", "云南省", "西藏自治区", "陕西省", "甘肃省", "青海省", "宁夏回族自治区", "新疆维吾尔自治区", "香港特别行政区", "澳门特别行政区", "台湾省"];

function displayPlace(place: PlaceMatch) {
  return [place.country, place.admin1, place.admin2, place.admin3, place.admin4, place.name]
    .filter((item, index, all): item is string => Boolean(item) && all.indexOf(item) === index)
    .join(" · ");
}

function cityName(place: PlaceMatch) {
  const candidates = [place.admin3, place.admin2, place.name];
  return candidates.find((item) => item && /市$|州$|盟$|地区$|府$|郡$|county$|city$/i.test(item)) || place.name;
}

function districtName(place: PlaceMatch) {
  return place.admin4 || (/区$|县$|旗$|镇$|乡$|borough$|district$/i.test(place.name) ? place.name : "");
}

export function PlaceHierarchyPicker({ defaultCity = "昆明", onChange }: { defaultCity?: string; onChange: (place: PlaceMatch | null) => void }) {
  const id = useId().replace(/:/g, "");
  const defaultChengdu = defaultCity.includes("成都");
  const [country, setCountry] = useState("中国");
  const [province, setProvince] = useState(defaultChengdu ? "四川省" : "云南省");
  const [city, setCity] = useState(defaultChengdu ? "成都市" : "昆明市");
  const [district, setDistrict] = useState("");
  const [place, setPlace] = useState<PlaceMatch | null>(null);
  const [activeLevel, setActiveLevel] = useState<"city" | "district" | null>(null);
  const [options, setOptions] = useState<PlaceMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState("");

  function resetPlace() {
    setPlace(null);
    setNotice("");
    onChange(null);
  }

  function buildQuery(level = activeLevel) {
    return [country, province, city, level === "district" ? district : ""].filter(Boolean).join(" ");
  }

  useEffect(() => {
    const keyword = activeLevel === "city" ? city : activeLevel === "district" ? district : "";
    if (!activeLevel || keyword.trim().length < 2) {
      setOptions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(buildQuery(activeLevel))}`, { signal: controller.signal });
        const data = await response.json() as { results?: PlaceMatch[] };
        const unique = new Map<string, PlaceMatch>();
        for (const item of data.results ?? []) {
          const label = activeLevel === "city" ? cityName(item) : districtName(item) || item.name;
          if (label && !unique.has(label)) unique.set(label, item);
        }
        setOptions([...unique.values()].slice(0, 8));
      } catch (error) {
        if ((error as Error).name !== "AbortError") setOptions([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [activeLevel, city, country, district, province]);

  function selectOption(option: PlaceMatch, level = activeLevel) {
    const nextCity = cityName(option);
    const nextDistrict = districtName(option);
    setCountry(option.country || country);
    setProvince(option.admin1 || province);
    if (nextCity) setCity(nextCity);
    if (level === "district") setDistrict(nextDistrict || option.name);
    setPlace(option);
    setOptions([]);
    setActiveLevel(null);
    setNotice("");
    onChange(option);
  }

  async function confirmPlace() {
    if (!country.trim() || !province.trim() || !city.trim()) {
      setNotice("请至少填写国家、省级行政区和地级市。");
      return;
    }
    setSearching(true);
    setNotice("");
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(buildQuery(district.trim() ? "district" : "city"))}`);
      const data = await response.json() as { results?: PlaceMatch[] };
      const target = (data.results ?? [])[0];
      if (!target) throw new Error("没有找到完全匹配的行政区，请检查国家、省市名称后重试。");
      selectOption(target, district.trim() ? "district" : "city");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "地点确认失败，请稍后重试。");
    } finally {
      setSearching(false);
    }
  }

  return <section className="hierarchy-place" aria-label="出生地点四级选择">
    <header><b>出生地点</b><span>优先确认地级市，区县可选填</span></header>
    <div className="hierarchy-place-grid">
      <label>国家 / 地区
        <input list={`${id}-countries`} value={country} onChange={(event) => { resetPlace(); setCountry(event.target.value); setProvince(""); setCity(""); setDistrict(""); }} placeholder="选择或填写国家" />
        <datalist id={`${id}-countries`}>{COUNTRIES.map((item) => <option key={item} value={item} />)}</datalist>
      </label>
      <label>省 / 州
        <input list={`${id}-provinces`} value={province} onChange={(event) => { resetPlace(); setProvince(event.target.value); setCity(""); setDistrict(""); }} placeholder="选择或填写省州" />
        <datalist id={`${id}-provinces`}>{country.includes("中国") && CHINA_PROVINCES.map((item) => <option key={item} value={item} />)}</datalist>
      </label>
      <label className="hierarchy-combobox">地级市
        <input value={city} onFocus={() => setActiveLevel("city")} onChange={(event) => { resetPlace(); setActiveLevel("city"); setCity(event.target.value); setDistrict(""); }} placeholder="选择或填写城市" autoComplete="off" />
        {activeLevel === "city" && options.length > 0 && <div className="hierarchy-options">{options.map((option) => <button type="button" key={option.id} onClick={() => selectOption(option, "city")}><b>{cityName(option)}</b><small>{displayPlace(option)}</small></button>)}</div>}
      </label>
      <label className="hierarchy-combobox">区 / 县（选填）
        <input value={district} onFocus={() => setActiveLevel("district")} onChange={(event) => { resetPlace(); setActiveLevel("district"); setDistrict(event.target.value); }} placeholder="选择或填写区县" autoComplete="off" />
        {activeLevel === "district" && options.length > 0 && <div className="hierarchy-options">{options.map((option) => <button type="button" key={option.id} onClick={() => selectOption(option, "district")}><b>{districtName(option) || option.name}</b><small>{displayPlace(option)}</small></button>)}</div>}
      </label>
    </div>
    <div className="hierarchy-confirm"><button type="button" onClick={() => void confirmPlace()} disabled={searching}>{searching ? "正在核对地点…" : "确认出生地点"}</button><span>{place ? `已确认：${displayPlace(place)}` : "请选择候选或点击确认，以匹配经纬度与时区"}</span></div>
    {notice && <p>{notice}</p>}
  </section>;
}
