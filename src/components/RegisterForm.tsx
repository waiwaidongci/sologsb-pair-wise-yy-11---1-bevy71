import { useMemo, useState } from "react";
import type { RegisterInput } from "../types";
import { mixLabel, validateRegister } from "../logic";

interface Props {
  onRegister: (input: RegisterInput) => void;
}

interface FormState {
  serial: string;
  volume: string;
  inspectionDate: string;
  residualPressure: string;
  targetPressure: string;
  targetO2: string;
  targetHe: string;
}

const initialState: FormState = {
  serial: "",
  volume: "12",
  inspectionDate: "",
  residualPressure: "50",
  targetPressure: "200",
  targetO2: "21",
  targetHe: "0",
};

export default function RegisterForm({ onRegister }: Props) {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const mixHint = useMemo(() => {
    const o2 = Number(form.targetO2);
    const he = Number(form.targetHe);
    if (!Number.isFinite(o2)) return "";
    return mixLabel(o2, Number.isFinite(he) ? he : 0);
  }, [form.targetO2, form.targetHe]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: RegisterInput = {
      serial: form.serial.trim().toUpperCase(),
      volume: Number(form.volume),
      inspectionDate: form.inspectionDate,
      residualPressure: Number(form.residualPressure),
      targetPressure: Number(form.targetPressure),
      targetO2: Number(form.targetO2),
      targetHe: Number(form.targetHe),
    };
    const nextErrors = validateRegister(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onRegister(input);
    setForm({ ...initialState });
    setErrors({});
  }

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p>气瓶登记</p>
          <h2>登记后进入待充填队列</h2>
        </div>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field-grid">
          <label className="wide">
            <span>气瓶编号</span>
            <input
              value={form.serial}
              onChange={set("serial")}
              placeholder="例如 TANK-204"
            />
            {errors.serial && <em className="field-error">{errors.serial}</em>}
          </label>

          <label>
            <span>容积（L）</span>
            <input type="number" min="1" step="0.5" value={form.volume} onChange={set("volume")} />
            {errors.volume && <em className="field-error">{errors.volume}</em>}
          </label>

          <label>
            <span>检验有效期</span>
            <input type="date" value={form.inspectionDate} onChange={set("inspectionDate")} />
            {errors.inspectionDate && (
              <em className="field-error">{errors.inspectionDate}</em>
            )}
          </label>

          <label>
            <span>残压（bar）</span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.residualPressure}
              onChange={set("residualPressure")}
            />
            {errors.residualPressure && (
              <em className="field-error">{errors.residualPressure}</em>
            )}
          </label>

          <label>
            <span>目标压力（bar）</span>
            <input
              type="number"
              min="1"
              step="1"
              value={form.targetPressure}
              onChange={set("targetPressure")}
            />
            {errors.targetPressure && (
              <em className="field-error">{errors.targetPressure}</em>
            )}
          </label>

          <label>
            <span>目标氧含量 O₂（%）</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.targetO2}
              onChange={set("targetO2")}
            />
            {errors.targetO2 && <em className="field-error">{errors.targetO2}</em>}
          </label>

          <label>
            <span>目标氦含量 He（%，空气填 0）</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.targetHe}
              onChange={set("targetHe")}
            />
            {errors.targetHe && <em className="field-error">{errors.targetHe}</em>}
          </label>
        </div>

        {mixHint && (
          <p className="mix-hint">
            <b>混合气比例：</b>
            {mixHint}
            {Number(form.targetO2) > 40 && (
              <span className="mix-warn">（氧含量超过 40%，需专用高氧设备并确认气瓶兼容）</span>
            )}
          </p>
        )}

        <button type="submit" className="primary submit-btn">
          登记并入队
        </button>
      </form>
    </section>
  );
}
