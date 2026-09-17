import type { FillTask } from "./types";
import { todayISO, toISODate } from "./utils";

const STORAGE_KEY = "dive-shop-fill-tasks-v1";

/** 首次打开时的演示数据：覆盖待充填、过期拦截、充填中、已签收历史 */
function seedTasks(): FillTask[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const future = (days: number) =>
    toISODate(new Date(new Date(todayISO() + "T00:00:00").getTime() + days * day));
  const past = (days: number) =>
    toISODate(new Date(new Date(todayISO() + "T00:00:00").getTime() - days * day));

  return [
    {
      id: "T-1001",
      cylinderId: "TANK-204",
      volume: "12L 铝瓶",
      inspectionExpiry: future(95),
      residualPressure: 55,
      targetPressure: 200,
      heliumPercent: 0,
      status: "queued",
      createdAt: now - 2 * 60 * 60 * 1000,
    },
    {
      id: "T-1002",
      cylinderId: "TANK-231",
      volume: "双瓶组 2×12L",
      inspectionExpiry: future(12),
      residualPressure: 30,
      targetPressure: 230,
      heliumPercent: 18,
      status: "queued",
      createdAt: now - 50 * 60 * 1000,
    },
    {
      id: "T-1003",
      cylinderId: "TANK-188",
      volume: "11L 钢瓶",
      inspectionExpiry: past(20),
      residualPressure: 10,
      targetPressure: 200,
      heliumPercent: 0,
      status: "queued",
      createdAt: now - 20 * 60 * 1000,
    },
    {
      id: "T-1004",
      cylinderId: "TANK-219",
      volume: "11L 钢瓶",
      inspectionExpiry: future(200),
      residualPressure: 45,
      targetPressure: 210,
      heliumPercent: 0,
      status: "filling",
      createdAt: now - 80 * 60 * 1000,
      startedAt: now - 25 * 60 * 1000,
    },
    {
      id: "T-0998",
      cylinderId: "TANK-204",
      volume: "12L 铝瓶",
      inspectionExpiry: future(120),
      residualPressure: 60,
      targetPressure: 200,
      heliumPercent: 0,
      status: "signed",
      createdAt: now - 9 * 24 * 60 * 60 * 1000,
      startedAt: now - 9 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000,
      actualPressure: 200,
      oxygenPercent: 20.9,
      fillMethod: "空气充填",
      operator: "陈海",
      signedAt: now - 9 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000,
    },
  ];
}

export function loadTasks(): FillTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FillTask[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // 存储不可用时直接使用演示数据
  }
  return seedTasks();
}

export function saveTasks(tasks: FillTask[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // 忽略写入失败（隐私模式等），本次会话仍可正常操作
  }
}
