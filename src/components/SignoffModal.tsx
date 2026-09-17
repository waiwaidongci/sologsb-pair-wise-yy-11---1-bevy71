import { useState } from "react";
import type { FillTask, SignoffValues, FillMethod } from "../types";
import { FILL_METHODS, mixHint, validateSignoff } from "../utils";

interface Props {
  task: FillTask;
  /** 返回 null 表示签收成功并关闭弹窗；返回错误信息则保留在弹窗内 */
  onSubmit: (values: SignoffValues) => string | null;
  onClose: () => void;
}

/** 结束充填弹窗：实际压力、氧含量、充填方式、操作员四者必须齐全合格才能签收 */
export function SignoffModal({ task, onSubmit, onClose }: Props) {
  const [actualPressure, setActualPressure] = useState("");
  const [oxygenPercent, setOxygenPercent] = useState("");
  const [fillMethod, setFillMethod] = useState<FillMethod | "">("");
  const [operator, setOperator] = useState("");
  const [error, setError] = useState<string | null>(null);

  const oxygenNum = oxygenPercent === "" ? "" : Number(oxygenPercent);
  const hint = mixHint(oxygenNum, task.heliumPercent);
  const airMismatch = fillMethod === "空气充填" && oxygenNum !== "" && Math.abs(Number(oxygenNum) - 20.9) > 4;

  function handleSubmit() {
    const err = validateSignoff(
      { actualPressure, oxygenPercent, fillMethod, operator },
      task.targetPressure
    );
    if (err) {
      setError(err);
      return;
    }
    const result = onSubmit({
      actualPressure: Number(actualPressure),
      oxygenPercent: Number(oxygenPercent),
      fillMethod: fillMethod as FillMethod,
      operator: operator.trim(),
    });
    if (result) setError(result);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="heading">
          <div>
            <p>结束充填</p>
            <h2>{task.cylinderId}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <p className="modal-sub">
          {task.volume} · 残压 {task.residualPressure}bar · 目标压力 {task.targetPressure}bar
        </p>

        <div className="field-grid">
          <label>
            <span>实际压力 (bar) *</span>
            <input
              type="number"
              value={actualPressure}
              onChange={(e) => setActualPressure(e.target.value)}
              placeholder={`不低于 ${task.targetPressure}bar 才能签收`}
            />
          </label>
          <label>
            <span>氧含量 (%) *</span>
            <input
              type="number"
              step="0.1"
              value={oxygenPercent}
              onChange={(e) => setOxygenPercent(e.target.value)}
              placeholder="如 20.9 / 32"
            />
          </label>
          <label>
            <span>充填方式 *</span>
            <select value={fillMethod} onChange={(e) => setFillMethod(e.target.value as FillMethod)}>
              <option value="">请选择充填方式</option>
              {FILL_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            <span>操作员 *</span>
            <input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="签收操作员姓名" />
          </label>
        </div>

        <div className={`mix-hint mix-${hint.tone}`}>
          <b>{hint.tag}</b>
          <span>{hint.detail}</span>
          {task.heliumPercent > 0 && <em>登记氦含量 {task.heliumPercent}%</em>}
        </div>
        {airMismatch && (
          <div className="mix-hint mix-warn">
            <b>方式不符</b>
            <span>空气充填通常 O₂ ≈ 20.9%，当前氧含量 {oxygenPercent}%，请确认是否应改为高氧充填</span>
          </div>
        )}

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          <button onClick={onClose}>取消</button>
          <button className="primary" onClick={handleSubmit}>确认签收</button>
        </div>
        <p className="modal-note">信息不齐或压力未达标时无法签收，气瓶不会被放行。</p>
      </div>
    </div>
  );
}
