export type TaskStatus = "queued" | "filling" | "done";

export type FillMethod = "空气" | "高氧" | "Trimix";

export interface FillTask {
  id: string;
  serial: string;
  volume: number;
  inspectionDate: string; // YYYY-MM-DD
  residualPressure: number;
  targetPressure: number;
  targetO2: number; // 目标氧含量 %
  targetHe: number; // 目标氦含量 %
  status: TaskStatus;
  createdAt: number;
  startedAt: number | null;
  // 结束充填（签收）时填写
  actualPressure: number | null;
  actualO2: number | null;
  actualHe: number | null;
  fillMethod: FillMethod | null;
  operator: string;
  signedAt: number | null;
}

export interface RegisterInput {
  serial: string;
  volume: number;
  inspectionDate: string;
  residualPressure: number;
  targetPressure: number;
  targetO2: number;
  targetHe: number;
}
