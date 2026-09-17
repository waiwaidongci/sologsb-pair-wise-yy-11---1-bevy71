import { useMemo, useState } from "react";
import type { FillMethod, FillTask } from "../types";
import { O2_RANGE, mixLabel, validateSignoff, type SignoffInput } from "../logic";

interface Props {
  task: FillTask;
  onCancel: () => void;
  onConfirm: (
    values: {
      actualPressure: number;
      actualO2: number;
      actualHe: number;
      fillMethod: FillMethod;
      operator: string;
    },
  ) => void;
}

function defaultMethod(task: FillTask): FillMethod {
  if (task.targetHe > 0) return "Trimix";
  if (task.targetO2 > 21.5) return "高氧";
  return "空气";
}

export default function SignoffModal({ task, onCancel, onConfirm }: Props) {
  const [values, setValues] = useState<SignoffInput>({
    actualPressure: String(task.targetPressure),
    actualO2: String(task.targetO2),
    actualHe: task.targetHe > 0 ? String(task.targetHe) : "",
    fillMethod: defaultMethod(task),
    operator: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const range = values.fillMethod ? O2_RANGE[values.fillMethod] : null;

  const liveHint = useMemo(() => {
    const o2 = Number(values.actualO2);
    if (values.actualO2.trim() === "" || !Number.isFinite(o2)) return null;
    const he = values.actualHe.trim() === "" ? 0 : Number(values.actualHe);
    return mixLabel(o2, Number.isFinite(he) ? he : 0);
  }, [values.actualO2, values.actualHe]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = validateSignoff(task, values);
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onConfirm({
      actualPressure: Number(values.actualPressure),
      actualO2: Number(values.actualO2),
      actualHe: values.actualHe.trim() === "" ? 0 : Number(values.actualHe),
      fillMethod: values.fillMethod as FillMethod,
      operator: values.operator.trim(),
    });
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={`${task.serial} 充填签收`}>
        <div className="heading">
          <div>
            <p>结束充填 · 签收核验</p>
            <h2>{task.serial}</h2>
          </div>
          <button className="modal-close" onClick={onCancel} aria-label="取消签收">
            ✕
          </button>
        </div>

        <p className="modal-target">
          目标：{task.targetPressure} bar · {mixLabel(task.targetO2, task.targetHe)}。
          信息填写不齐或不达标不能签收，气瓶会留在队列继续处理。
        </p>

        <form onSubmit={submit} noValidate>
          <div className="field-grid">
            <label>
              <span>实际压力（bar，不低于目标 {task.targetPressure}）</span>
              <input
                type="number"
                min="0"
                step="1"
                value={values.actualPressure}
                onChange={(e) => setValues((v) => ({ ...v, actualPressure: e.target.value }))}
              />
              {errors.actualPressure && <em className="field-error">{errors.actualPressure}</em>}
            </label>

            <label>
              <span>实际氧含量 O₂（%）</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={values.actualO2}
                onChange={(e) => setValues((v) => ({ ...v, actualO2: e.target.value }))}
              />
              {errors.actualO2 && <em className="field-error">{errors.actualO2}</em>}
            </label>

            <label>
              <span>
                实际氦含量 He（%{values.fillMethod === "Trimix" ? "，Trimix 必填" : "，可留空按 0"}）
              </span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={values.actualHe}
                onChange={(e) => setValues((v) => ({ ...v, actualHe: e.target.value }))}
              />
              {errors.actualHe && <em className="field-error">{errors.actualHe}</em>}
            </label>

            <label>
              <span>充填方式</span>
              <select
                value={values.fillMethod}
                onChange={(e) =>
                  setValues((v) => ({ ...v, fillMethod: e.target.value as FillMethod | "" }))
                }
              >
                <option value="">请选择</option>
                <option value="空气">空气</option>
                <option value="高氧">高氧（Nitrox）</option>
                <option value="Trimix">Trimix</option>
              </select>
              {errors.fillMethod && <em className="field-error">{errors.fillMethod}</em>}
            </label>

            <label className="wide">
              <span>操作员</span>
              <input
                value={values.operator}
                onChange={(e) => setValues((v) => ({ ...v, operator: e.target.value }))}
                placeholder="执行并核验本次充填的工作人员姓名"
              />
              {errors.operator && <em className="field-error">{errors.operator}</em>}
            </label>
          </div>

          {range && (
            <p className="mix-hint">
              {values.fillMethod} 充填允许的 O₂ 范围：{range.min}–{range.max}%
              {liveHint && <> · 实测配比：{liveHint}</>}
            </p>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onCancel}>
              取消（气瓶继续充填中）
            </button>
            <button type="submit" className="primary">
              核验并签收
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
