import type { FillMethod } from "./types";

export const FILL_METHODS: FillMethod[] = ["空气充填", "高氧充填", "Trimix充填"];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 当地日期 yyyy-mm-dd，避免 UTC 偏移导致跨天误判 */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/**
 * 检验有效期状态。有效期早于今天即视为过期，不能开始充填。
 * 剩余 14 天内给出临期提醒。
 */
export function inspectionStatus(
  expiry: string
): { expired: boolean; daysLeft: number; label: string } {
  if (!expiry) {
    return { expired: true, daysLeft: NaN, label: "未填写检验有效期" };
  }
  const today = new Date(todayISO() + "T00:00:00");
  const end = new Date(expiry + "T00:00:00");
  const daysLeft = Math.round((end.getTime() - today.getTime()) / MS_PER_DAY);
  if (daysLeft < 0) {
    return { expired: true, daysLeft, label: `检验已过期 ${Math.abs(daysLeft)} 天` };
  }
  if (daysLeft === 0) return { expired: false, daysLeft, label: "检验有效期今日到期" };
  if (daysLeft <= 14) return { expired: false, daysLeft, label: `检验期剩余 ${daysLeft} 天` };
  return { expired: false, daysLeft, label: `检验有效至 ${expiry}` };
}

/** 混合气比例提示：剩余成分为氮，并按 O2/He 判断气体类别 */
export function mixHint(
  oxygen: number | "",
  helium: number
): { nitrogen: number | null; tag: string; detail: string; tone: "info" | "warn" } {
  if (oxygen === "" || Number.isNaN(oxygen)) {
    return { nitrogen: null, tag: "混合气比例", detail: "填写氧含量后自动计算氮气比例", tone: "info" };
  }
  const o2 = Number(oxygen);
  const he = Number(helium) || 0;
  if (o2 < 0 || o2 > 100 || he < 0 || he > 100) {
    return { nitrogen: null, tag: "比例异常", detail: "含量必须在 0–100% 之间", tone: "warn" };
  }
  const n2 = Math.round((100 - o2 - he) * 10) / 10;
  if (n2 < 0) {
    return {
      nitrogen: null,
      tag: "比例超出 100%",
      detail: `O₂ ${o2}% + He ${he}% = ${o2 + he}%，请核对成分含量`,
      tone: "warn",
    };
  }
  let tag = "空气";
  if (he > 0) tag = "Trimix";
  else if (o2 >= 22) tag = "高氧 EAN";
  const parts = [`O₂ ${o2}%`, `N₂ ${n2}%`];
  if (he > 0) parts.push(`He ${he}%`);
  return { nitrogen: n2, tag, detail: parts.join(" · "), tone: "info" };
}

/** 结束充填签收校验：四要素必须齐全且合格，避免放行不合格气瓶 */
export function validateSignoff(
  values: {
    actualPressure: string;
    oxygenPercent: string;
    fillMethod: FillMethod | "";
    operator: string;
  },
  targetPressure: number
): string | null {
  const operator = values.operator.trim();
  if (!values.actualPressure && values.actualPressure !== "0")
    return "请填写实际压力";
  const p = Number(values.actualPressure);
  if (Number.isNaN(p)) return "实际压力必须是数字";
  if (p <= 0) return "实际压力必须大于 0";
  if (p < targetPressure)
    return `实际压力 ${p}bar 未达到目标压力 ${targetPressure}bar，不能签收放行`;

  if (values.oxygenPercent === "") return "请填写氧含量";
  const o2 = Number(values.oxygenPercent);
  if (Number.isNaN(o2)) return "氧含量必须是数字";
  if (o2 < 18 || o2 > 100) return "氧含量应在 18%–100% 之间";
  if (!values.fillMethod) return "请选择充填方式";
  if (!operator) return "请填写操作员";
  return null;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
