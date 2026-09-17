export type FillMethod = "空气充填" | "高氧充填" | "Trimix充填";

export type TaskStatus = "queued" | "filling" | "signed";

/** 一张充填单：登记后进入待充填队列，签收后随记录永久保留 */
export interface FillTask {
  id: string;
  cylinderId: string;
  volume: string;
  /** 检验有效期，ISO 日期 yyyy-mm-dd */
  inspectionExpiry: string;
  residualPressure: number;
  targetPressure: number;
  /** 氦含量 %，普通空气/高氧为 0 */
  heliumPercent: number;
  status: TaskStatus;
  createdAt: number;
  startedAt?: number;
  // —— 结束充填 / 签收时填写 ——
  actualPressure?: number;
  oxygenPercent?: number;
  fillMethod?: FillMethod;
  operator?: string;
  signedAt?: number;
}

export interface RegisterInput {
  cylinderId: string;
  volume: string;
  inspectionExpiry: string;
  // 数字输入框保留原始字符串，提交时再做数值校验
  residualPressure: string;
  targetPressure: string;
  heliumPercent: string;
}

export interface SignoffValues {
  actualPressure: number;
  oxygenPercent: number;
  fillMethod: FillMethod;
  operator: string;
}
