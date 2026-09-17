import type { FillTask } from "../types";
import { inspectionStatus, formatTime } from "../utils";

interface Props {
  task: FillTask;
  /** 过期等拦截原因（点击“开始充填”后给出，留在队列上展示） */
  blockReason?: string;
  onStart: (task: FillTask) => void;
  onSignoff: (task: FillTask) => void;
}

const STATUS_TEXT: Record<FillTask["status"], string> = {
  queued: "待充填",
  filling: "充填中",
  signed: "已签收",
};

export function QueueCard({ task, blockReason, onStart, onSignoff }: Props) {
  const insp = inspectionStatus(task.inspectionExpiry);
  const filling = task.status === "filling";

  return (
    <article className={`queue-card ${insp.expired ? "is-expired" : ""} ${filling ? "is-filling" : ""}`}>
      <div className="queue-main">
        <div className="queue-title">
          <h3>{task.cylinderId}</h3>
          <span className={`badge badge-${task.status}`}>{STATUS_TEXT[task.status]}</span>
          {insp.expired
            ? <span className="badge badge-danger">检验过期</span>
            : insp.daysLeft <= 14 && <span className="badge badge-warn">检验临期</span>}
        </div>
        <p className="queue-meta">
          {task.volume} · 残压 {task.residualPressure}bar → 目标 {task.targetPressure}bar
          {task.heliumPercent > 0 ? ` · He ${task.heliumPercent}%` : ""}
        </p>
        <p className={`queue-inspection ${insp.expired ? "text-danger" : insp.daysLeft <= 14 ? "text-warn" : ""}`}>
          检验有效期 {task.inspectionExpiry}（{insp.label}）
        </p>
        <p className="queue-time">登记于 {formatTime(task.createdAt)}</p>

        {blockReason && (
          <div className="block-reason" role="alert">
            <b>不能开始充填：</b>{blockReason}
          </div>
        )}
      </div>

      <div className="queue-actions">
        {!filling && (
          <button className="primary" onClick={() => onStart(task)}>
            开始充填
          </button>
        )}
        {filling && (
          <button className="primary" onClick={() => onSignoff(task)}>结束充填 / 签收</button>
        )}
        {insp.expired && <small className="text-danger">点击开始将被拦截并记录原因</small>}
      </div>
    </article>
  );
}
