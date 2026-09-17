import type { FillTask } from "../types";
import { daysUntil, formatDateTime, isExpired, mixLabel } from "../logic";

interface Props {
  tasks: FillTask[]; // 队列内任务（queued + filling），按登记时间排序
  onStart: (task: FillTask) => void;
  onFinish: (task: FillTask) => void;
  busySerials: Set<string>; // 已存在“进行中”充填任务的气瓶编号
}

function InspectionTag({ task }: { task: FillTask }) {
  if (isExpired(task.inspectionDate)) {
    const days = Math.abs(daysUntil(task.inspectionDate));
    return (
      <div className="tag tag-danger">
        检验已过期 {days} 天（有效期至 {task.inspectionDate}），不可开始充填
      </div>
    );
  }
  const days = daysUntil(task.inspectionDate);
  if (days <= 30) {
    return (
      <div className="tag tag-warn">
        检验有效期剩余 {days} 天（至 {task.inspectionDate}），请尽快送检
      </div>
    );
  }
  return <div className="tag tag-ok">检验有效期至 {task.inspectionDate}</div>;
}

function QueueCard({
  task,
  busy,
  onStart,
  onFinish,
}: {
  task: FillTask;
  busy: boolean;
  onStart: () => void;
  onFinish: () => void;
}) {
  const expired = isExpired(task.inspectionDate);
  const filling = task.status === "filling";

  return (
    <article className={`queue-card ${filling ? "is-filling" : ""} ${expired ? "is-expired" : ""}`}>
      <div className="queue-head">
        <div>
          <h3>{task.serial}</h3>
          <p className="queue-time">
            {filling && task.startedAt
              ? `开始于 ${formatDateTime(task.startedAt)}`
              : `登记于 ${formatDateTime(task.createdAt)}`}
          </p>
        </div>
        <span className={`status-badge status-${task.status}`}>
          {filling ? "充填中" : "待充填"}
        </span>
      </div>

      <InspectionTag task={task} />

      <dl className="queue-info">
        <div>
          <dt>容积</dt>
          <dd>{task.volume} L</dd>
        </div>
        <div>
          <dt>残压→目标</dt>
          <dd>
            {task.residualPressure} → {task.targetPressure} bar
          </dd>
        </div>
        <div className="queue-info-wide">
          <dt>目标气体</dt>
          <dd>{mixLabel(task.targetO2, task.targetHe)}</dd>
        </div>
      </dl>

      {filling ? (
        <button className="primary" onClick={onFinish}>
          结束充填 / 签收
        </button>
      ) : expired ? (
        <button disabled title="检验过期气瓶不能开始充填">
          不能开始充填
        </button>
      ) : busy ? (
        <button disabled title="该气瓶已有进行中的充填任务">
          已被进行中任务占用
        </button>
      ) : (
        <button className="start-btn" onClick={onStart}>
          开始充填
        </button>
      )}
    </article>
  );
}

export default function FillQueue({ tasks, onStart, onFinish, busySerials }: Props) {
  return (
    <section className="panel queue-panel">
      <div className="heading">
        <div>
          <p>工作台</p>
          <h2>待充填队列（{tasks.length}）</h2>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          队列暂无气瓶。完成左侧登记后，气瓶会出现在这里等待充填。
        </div>
      ) : (
        <div className="queue-list">
          {tasks.map((task) => (
            <QueueCard
              key={task.id}
              task={task}
              busy={task.status === "queued" && busySerials.has(task.serial.trim().toUpperCase())}
              onStart={() => onStart(task)}
              onFinish={() => onFinish(task)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
