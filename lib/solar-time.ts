export type PlaceMatch = {
  id: string;
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  source: "local" | "open-meteo";
};

export type SolarTimeResult = {
  civilTime: string;
  trueSolarTime: string;
  utcTime: string;
  timezone: string;
  timezoneOffsetMinutes: number;
  standardMeridian: number;
  longitude: number;
  longitudeCorrectionMinutes: number;
  equationOfTimeMinutes: number;
  totalCorrectionMinutes: number;
  precision: "estimated";
  method: string;
};

export const COMMON_CHINA_PLACES: PlaceMatch[] = [
  { id: "cn-beijing", name: "北京市", country: "中国", latitude: 39.9042, longitude: 116.4074, timezone: "Asia/Shanghai", source: "local" },
  { id: "cn-shanghai", name: "上海市", country: "中国", latitude: 31.2304, longitude: 121.4737, timezone: "Asia/Shanghai", source: "local" },
  { id: "cn-guangzhou", name: "广州市", admin1: "广东省", country: "中国", latitude: 23.1291, longitude: 113.2644, timezone: "Asia/Shanghai", source: "local" },
  { id: "cn-shenzhen", name: "深圳市", admin1: "广东省", country: "中国", latitude: 22.5431, longitude: 114.0579, timezone: "Asia/Shanghai", source: "local" },
  { id: "cn-chengdu", name: "成都市", admin1: "四川省", country: "中国", latitude: 30.5728, longitude: 104.0668, timezone: "Asia/Shanghai", source: "local" },
  { id: "cn-chongqing", name: "重庆市", country: "中国", latitude: 29.563, longitude: 106.5516, timezone: "Asia/Shanghai", source: "local" },
  { id: "cn-hangzhou", name: "杭州市", admin1: "浙江省", country: "中国", latitude: 30.2741, longitude: 120.1551, timezone: "Asia/Shanghai", source: "local" },
  { id: "cn-nanjing", name: "南京市", admin1: "江苏省", country: "中国", latitude: 32.0603, longitude: 118.7969, timezone: "Asia/Shanghai", source: "local" },
  { id: "cn-wuhan", name: "武汉市", admin1: "湖北省", country: "中国", latitude: 30.5928, longitude: 114.3055, timezone: "Asia/Shanghai", source: "local" },
  { id: "cn-xian", name: "西安市", admin1: "陕西省", country: "中国", latitude: 34.3416, longitude: 108.9398, timezone: "Asia/Shanghai", source: "local" },
  { id: "cn-kunming", name: "昆明市", admin1: "云南省", country: "中国", latitude: 25.0389, longitude: 102.7183, timezone: "Asia/Shanghai", source: "local" },
  { id: "cn-lhasa", name: "拉萨市", admin1: "西藏自治区", country: "中国", latitude: 29.652, longitude: 91.1721, timezone: "Asia/Shanghai", source: "local" },
  { id: "cn-urumqi", name: "乌鲁木齐市", admin1: "新疆维吾尔自治区", country: "中国", latitude: 43.8256, longitude: 87.6168, timezone: "Asia/Shanghai", source: "local" },
  { id: "cn-harbin", name: "哈尔滨市", admin1: "黑龙江省", country: "中国", latitude: 45.8038, longitude: 126.5349, timezone: "Asia/Shanghai", source: "local" },
  { id: "cn-hongkong", name: "香港", country: "中国", latitude: 22.3193, longitude: 114.1694, timezone: "Asia/Hong_Kong", source: "local" },
  { id: "cn-macau", name: "澳门", country: "中国", latitude: 22.1987, longitude: 113.5439, timezone: "Asia/Macau", source: "local" },
  { id: "cn-taipei", name: "台北市", country: "中国", latitude: 25.033, longitude: 121.5654, timezone: "Asia/Taipei", source: "local" },
];

function parseLocalDateTime(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error("INVALID_LOCAL_TIME");
  const [, year, month, day, hour, minute, second = "0"] = match;
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
}

function partsAt(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function zonedLocalToUtc(localDateTime: string, timezone: string) {
  const local = parseLocalDateTime(localDateTime);
  const target = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  let guess = target;
  for (let pass = 0; pass < 3; pass += 1) {
    const p = partsAt(new Date(guess), timezone);
    const represented = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    guess += target - represented;
  }
  const instant = new Date(guess);
  const offsetMinutes = Math.round((target - instant.getTime()) / 60000);
  return { instant, offsetMinutes };
}

export function equationOfTimeMinutes(instant: Date) {
  const start = Date.UTC(instant.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()) - start) / 86400000);
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1 + (instant.getUTCHours() - 12) / 24);
  return 229.18 * (
    0.000075
    + 0.001868 * Math.cos(gamma)
    - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma)
    - 0.040849 * Math.sin(2 * gamma)
  );
}

function formatWallTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

export function calculateTrueSolarTime(input: {
  localDateTime: string;
  longitude: number;
  timezone: string;
}): SolarTimeResult {
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new Error("INVALID_LONGITUDE");
  }
  const local = parseLocalDateTime(input.localDateTime);
  const { instant, offsetMinutes } = zonedLocalToUtc(input.localDateTime, input.timezone);
  const standardMeridian = (offsetMinutes / 60) * 15;
  const longitudeCorrectionMinutes = 4 * (input.longitude - standardMeridian);
  const eot = equationOfTimeMinutes(instant);
  const totalCorrectionMinutes = longitudeCorrectionMinutes + eot;
  const localWallMs = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  const solarWall = new Date(localWallMs + totalCorrectionMinutes * 60000);

  return {
    civilTime: formatWallTime(new Date(localWallMs)),
    trueSolarTime: formatWallTime(solarWall),
    utcTime: instant.toISOString(),
    timezone: input.timezone,
    timezoneOffsetMinutes: offsetMinutes,
    standardMeridian: Number(standardMeridian.toFixed(4)),
    longitude: input.longitude,
    longitudeCorrectionMinutes: Number(longitudeCorrectionMinutes.toFixed(2)),
    equationOfTimeMinutes: Number(eot.toFixed(2)),
    totalCorrectionMinutes: Number(totalCorrectionMinutes.toFixed(2)),
    precision: "estimated",
    method: "IANA历史时区 + 经度时差 + NOAA均时差近似",
  };
}
