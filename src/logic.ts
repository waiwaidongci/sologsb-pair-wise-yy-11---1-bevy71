import type { FillMethod, FillTask, RegisterInput } from "./types";

export const STORAGE_KEY = "dive-fill-tasks-v1";

/** 以当地时区生成 YYYY-MM-DD（与 <input type="date"> 的值一致） */
export function todayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 检验有效期早于今天即过期；有效期恰好为今天仍可充填 */
export function isExpired(inspectionDate: string, today = todayString()): boolean {
  if (!inspectionDate) return true;
  return inspectionDate < today;
}

export function daysUntil(inspectionDate: string, today = todayString()): number {
  const target = new Date(`${inspectionDate}T00:00:00`).getTime();
  const base = new Date(`${today}T00:00:00`).getTime();
  return Math.round((target - base) / 86_400_000);
}

export function isActive(task: FillTask): boolean {
  return task.status === "queued" || task.status === "filling";
}

export function findOccupyingTask(
  tasks: FillTask[],
  serial: string,
  excludeId?: string,
): FillTask | undefined {
  const key = serial.trim().toUpperCase();
  return tasks.find(
    (t) => t.serial.trim().toUpperCase() === key && isActive(t) && t.id !== excludeId,
  );
}

/** 混合气比例提示：根据氧/氦含量判断气体类型并给出配比描述 */
export function mixLabel(o2: number, he: number): string {
  if (he > 0) {
    return `Trimix ${o2}/${he}（O₂ ${o2}% · He ${he}% · N₂ ${Math.max(0, 100 - o2 - he)}%）`;
  }
  if (o2 > 21) {
    return `高氧 EAN${o2}（O₂ ${o2}% · N₂ ${100 - o2}%）`;
  }
  if (o2 === 21) {
    return `空气（O₂ 21% · N₂ 79%）`;
  }
  return `O₂ ${o2}%${he > 0 ? ` · He ${he}%` : ""}`;
}

/** 各充填方式允许的氧含量区间（%） */
export const O2_RANGE: Record<FillMethod, { min: number; max: number }> = {
  空气: { min: 20.5, max: 21.5 },
  高氧: { min: 22, max: 40 },
  Trimix: { min: 16, max: 40 },
};

export interface SignoffInput {
  actualPressure: string;
  actualO2: string;
  actualHe: string;
  fillMethod: FillMethod | "";
  operator: string;
}

export function validateRegister(input: RegisterInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.serial.trim()) errors.serial = "请填写气瓶编号";
  if (!Number.isFinite(input.volume) || input.volume <= 0)
    errors.volume = "容积必须大于 0";
  if (!input.inspectionDate) {
    errors.inspectionDate = "请选择检验有效期";
  }
  if (!Number.isFinite(input.residualPressure) || input.residualPressure < 0)
    errors.residualPressure = "残压不能为负";
  if (
    !Number.isFinite(input.targetPressure) ||
    input.targetPressure <= input.residualPressure
  )
    errors.targetPressure = "目标压力必须高于残压";
  if (!Number.isFinite(input.targetO2) || input.targetO2 < 0 || input.targetO2 > 100)
    errors.targetO2 = "氧含量需在 0–100% 之间";
  if (!Number.isFinite(input.targetHe) || input.targetHe < 0 || input.targetHe > 100)
    errors.targetHe = "氦含量需在 0–100% 之间";
  if (
    Number.isFinite(input.targetO2) &&
    Number.isFinite(input.targetHe) &&
    input.targetO2 + input.targetHe > 100
  )
    errors.targetHe = "氧含量与氦含量之和不能超过 100%";
  return errors;
}

/**
 * 校验结束充填的签收信息。信息不齐或不合格都会返回错误，
 * 调用方不得把气瓶从待充填队列放行。
 */
export function validateSignoff(
  task: FillTask,
  input: SignoffInput,
): Record<string, string> {
  const errors: Record<string, string> = {};

  const pressure = Number(input.actualPressure);
  if (input.actualPressure.trim() === "") {
    errors.actualPressure = "请填写实际压力";
  } else if (!Number.isFinite(pressure) || pressure <= 0) {
    errors.actualPressure = "实际压力必须大于 0";
  } else if (pressure < task.residualPressure) {
    errors.actualPressure = `实际压力不能低于残压 ${task.residualPressure} bar`;
  } else if (pressure < task.targetPressure) {
    errors.actualPressure = `未达到目标压力 ${task.targetPressure} bar，不能签收`;
  }

  const o2 = Number(input.actualO2);
  if (input.actualO2.trim() === "") {
    errors.actualO2 = "请填写实际氧含量";
  } else if (!Number.isFinite(o2) || o2 < 0 || o2 > 100) {
    errors.actualO2 = "氧含量需在 0–100% 之间";
  } else if (input.fillMethod) {
    const range = O2_RANGE[input.fillMethod];
    if (o2 < range.min || o2 > range.max) {
      errors.actualO2 = `${input.fillMethod}充填要求 O₂ 在 ${range.min}–${range.max}% 之间`;
    }
  }

  const he = Number(input.actualHe);
  if (input.actualHe.trim() !== "") {
    if (!Number.isFinite(he) || he < 0 || he > 100) {
      errors.actualHe = "氦含量需在 0–100% 之间";
    }
  }

  if (!input.fillMethod) {
    errors.fillMethod = "请选择充填方式";
  } else if (input.fillMethod === "Trimix") {
    if (input.actualHe.trim() === "") {
      errors.actualHe = "Trimix 必须填写氦含量";
    } else if (he < 1) {
      errors.actualHe = "Trimix 氦含量应大于 0%";
    }
  }

  if (
    input.actualO2.trim() !== "" &&
    input.actualHe.trim() !== "" &&
    Number.isFinite(o2) &&
    Number.isFinite(he) &&
    o2 + he > 100
  ) {
    errors.actualHe = "氧含量与氦含量之和不能超过 100%";
  }

  if (!input.operator.trim()) {
    errors.operator = "请填写操作员";
  }

  return errors;
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadTasks(): FillTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedTasks();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as FillTask[];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: FillTask[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

/** 首次打开时的演示数据，方便直接看到队列各状态 */
function seedTasks(): FillTask[] {
  const seed: FillTask[] = [
    {
      id: newId(),
      serial: "TANK-204",
      volume: 12,
      inspectionDate: "2027-03-01",
      residualPressure: 55,
      targetPressure: 200,
      targetO2: 21,
      targetHe: 0,
      status: "queued",
      createdAt: Date.now() - 1000 * 60 * 30,
      startedAt: null,
      actualPressure: null,
      actualO2: null,
      actualHe: null,
      fillMethod: null,
      operator: "",
      signedAt: null,
    },
    {
      id: newId(),
      serial: "TANK-231",
      volume: 11,
      inspectionDate: "2026-08-31",
      residualPressure: 30,
      targetPressure: 230,
      targetO2: 32,
      targetHe: 0,
      status: "queued",
      createdAt: Date.now() - 1000 * 60 * 12,
      startedAt: null,
      actualPressure: null,
      actualO2: null,
      actualHe: null,
      fillMethod: null,
      operator: "",
      signedAt: null,
    },
    {
      id: newId(),
      serial: "TANK-219",
      volume: 12,
      inspectionDate: "2027-06-15",
      residualPressure: 40,
      targetPressure: 200,
      targetO2: 32,
      targetHe: 0,
      status: "done",
      createdAt: Date.now() - 1000 * 60 * 60 * 26,
      startedAt: Date.now() - 1000 * 60 * 55,
      actualPressure: 200,
      actualO2: 32.1,
      actualHe: 0,
      fillMethod: "高氧",
      operator: "李潜",
      signedAt: Date.now() - 1000 * 60 * 50,
    },
  ];
  saveTasks(seed);
  return seed;
}
