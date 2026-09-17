import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { FillTask, RegisterInput, SignoffValues } from "./types";
import { loadTasks, saveTasks } from "./storage";
import { inspectionStatus } from "./utils";
import { Toast, type ToastData } from "./components/Toast";
import { QueueCard } from "./components/QueueCard";
import { SignoffModal } from "./components/SignoffModal";
import { HistoryPanel } from "./components/HistoryPanel";

const FILTERS = [
  { key: "active", label: "全部待处理" },
  { key: "queued", label: "待充填" },
  { key: "filling", label: "充填中" },
  { key: "attention", label: "待检验/临期" },
  { key: "expired", label: "已过期" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const emptyForm: RegisterInput = {
  cylinderId: "",
  volume: "",
  inspectionExpiry: "",
  residualPressure: "",
  targetPressure: "",
  heliumPercent: "",
};

function App() {
  const [tasks, setTasks] = useState<FillTask[]>(() => loadTasks());
  const [form, setForm] = useState<RegisterInput>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("active");
  const [signoffId, setSignoffId] = useState<string | null>(null);
  /** 被拦截气瓶展示的原因，key 为任务 id；刷新后过期标签仍在，重新点击会再次提示 */
  const [blockReasons, setBlockReasons] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastData | null>(null);

  // 刷新后状态保留
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function notify(type: ToastData["type"], message: string) {
    setToast({ type, message });
  }

  const metrics = useMemo(() => {
    const active = tasks.filter((t) => t.status !== "signed");
    const expired = active.filter((t) => inspectionStatus(t.inspectionExpiry).expired).length;
    const filling = active.filter((t) => t.status === "filling").length;
    const signed = tasks.filter((t) => t.status === "signed").length;
    const avgO2 = (() => {
      const signedWithO2 = tasks.filter((t) => t.status === "signed" && typeof t.oxygenPercent === "number");
      if (signedWithO2.length === 0) return "—";
      const avg = signedWithO2.reduce((sum, t) => sum + (t.oxygenPercent ?? 0), 0) / signedWithO2.length;
      return avg.toFixed(1) + "%";
    })();
    return { queued: active.length - filling, filling, expired, signed, avgO2 };
  }, [tasks]);

  // 待充填队列 = 待充填 + 充填中；已签收的已移出队列
  const queue = useMemo(() => {
    const active = tasks.filter((t) => t.status !== "signed");
    return active.filter((t) => {
      const insp = inspectionStatus(t.inspectionExpiry);
      switch (filter) {
        case "queued":
          return t.status === "queued";
        case "filling":
          return t.status === "filling";
        case "attention":
          return !insp.expired && insp.daysLeft <= 14;
        case "expired":
          return insp.expired;
        default:
          return true;
      }
    });
  }, [tasks, filter]);

  function updateForm<K extends keyof RegisterInput>(key: K, value: RegisterInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // —— 1. 登记：气瓶进入待充填队列 ——
  function handleRegister() {
    const cylinderId = form.cylinderId.trim().toUpperCase();
    const volume = form.volume.trim();
    if (!cylinderId) return setFormError("请填写气瓶编号");
    if (!volume) return setFormError("请填写容积（如 12L 铝瓶）");
    if (!form.inspectionExpiry) return setFormError("请选择检验有效期");

    const residual = form.residualPressure.trim() === "" ? NaN : Number(form.residualPressure);
    const target = form.targetPressure.trim() === "" ? NaN : Number(form.targetPressure);
    const helium = form.heliumPercent.trim() === "" ? 0 : Number(form.heliumPercent);
    if (Number.isNaN(residual) || residual < 0) return setFormError("残压必须是不小于 0 的数字");
    if (Number.isNaN(target) || target <= 0) return setFormError("目标压力必须是大于 0 的数字");
    if (residual > target) return setFormError("残压不能高于目标压力");
    if (Number.isNaN(helium) || helium < 0 || helium >= 100) return setFormError("氦含量应在 0–100% 之间");

    // 同瓶已有进行中任务（待充填或充填中）时允许再次登记但明确提示占用风险；
    // 是否产生第二条任务以“开始充填”时的占用校验为准（见 handleStart）
    const occupier = tasks.find(
      (t) => t.status !== "signed" && t.cylinderId.toUpperCase() === cylinderId
    );

    const task: FillTask = {
      id: "T-" + Date.now().toString(36).toUpperCase(),
      cylinderId,
      volume,
      inspectionExpiry: form.inspectionExpiry,
      residualPressure: residual,
      targetPressure: target,
      heliumPercent: helium,
      status: "queued",
      createdAt: Date.now(),
    };
    setTasks((prev) => [task, ...prev]);
    setForm(emptyForm);
    setFormError(null);

    if (occupier) {
      notify(
        "warn",
        `${cylinderId} 已有${occupier.status === "filling" ? "充填中" : "待充填"}任务（单号 ${occupier.id}），新登记单已入队，但开始充填时会被占用校验拦截`
      );
    } else {
      notify("success", `${cylinderId} 已登记，进入待充填队列`);
    }
  }

  // —— 2. 开始充填：过期拦截 + 同瓶进行中占用，二者都不产生半成品 ——
  function handleStart(task: FillTask) {
    // 最新状态再校验，防止并发/重复点击
    const current = tasks.find((t) => t.id === task.id);
    if (!current || current.status !== "queued") return;

    const occupier = tasks.find(
      (t) => t.id !== current.id && t.status === "filling" &&
        t.cylinderId.toUpperCase() === current.cylinderId.toUpperCase()
    );
    if (occupier) {
      setBlockReasons((prev) => ({
        ...prev,
        [current.id]: `该气瓶已有进行中的充填任务（单号 ${occupier.id}，${occupier.fillMethod ?? "等待结束充填"}），不可重复开始。`,
      }));
      notify("warn", `${current.cylinderId} 已被单号 ${occupier.id} 占用，未产生新任务`);
      return;
    }

    const insp = inspectionStatus(current.inspectionExpiry);
    if (insp.expired) {
      // 显示原因并留在队列，不改变任务状态
      setBlockReasons((prev) => ({
        ...prev,
        [current.id]: `检验有效期 ${current.inspectionExpiry}，${insp.label}，按规定不得充填。请联系客户送检后再开始。`,
      }));
      notify("error", `${current.cylinderId} ${insp.label}，不能开始充填`);
      return;
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === current.id ? { ...t, status: "filling", startedAt: Date.now() } : t))
    );
    setBlockReasons((prev) => {
      const next = { ...prev };
      delete next[current.id];
      return next;
    });
    notify("success", `${current.cylinderId} 开始充填`);
  }

  // —— 3. 结束充填 / 签收：四要素齐全且压力达标才放行 ——
  const signoffTask = signoffId ? tasks.find((t) => t.id === signoffId) : undefined;

  function handleSignoff(values: SignoffValues): string | null {
    if (!signoffTask) return "任务不存在";
    const current = tasks.find((t) => t.id === signoffTask.id);
    if (!current) return "任务不存在";
    if (current.status !== "filling") return "该任务不在充填中，不能签收";
    if (values.actualPressure < current.targetPressure)
      return `实际压力 ${values.actualPressure}bar 未达到目标压力 ${current.targetPressure}bar，不能签收放行`;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === current.id
          ? {
              ...t,
              status: "signed",
              actualPressure: values.actualPressure,
              oxygenPercent: values.oxygenPercent,
              fillMethod: values.fillMethod,
              operator: values.operator,
              signedAt: Date.now(),
            }
          : t
      )
    );
    setSignoffId(null);
    notify("success", `${current.cylinderId} 已签收（${values.fillMethod}，${values.actualPressure}bar），移出待充填队列`);
    return null;
  }

  return (
    <main className="app">
      <section className="hero">
        <p>潜水店气瓶充填工作台</p>
        <h1>潜水气瓶充填记录</h1>
        <span>登记 → 待充填队列 → 开始充填（校验检验有效期与占用）→ 结束充填填写四要素签收 → 单瓶历史可追溯。数据保存在本机，刷新后状态保留。</span>
      </section>

      <section className="metrics">
        <article><small>待充填</small><strong>{metrics.queued}</strong></article>
        <article><small>充填中</small><strong>{metrics.filling}</strong></article>
        <article><small>过期/不可充填</small><strong className={metrics.expired ? "text-danger" : ""}>{metrics.expired}</strong></article>
        <article><small>已签收 / 平均氧含量</small><strong>{metrics.signed} <em className="metric-sub">{metrics.avgO2}</em></strong></article>
      </section>

      <section className="workspace">
        <aside className="panel">
          <h2>队列筛选</h2>
          <div className="chips">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                className={filter === item.key ? "chip-active" : ""}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="rules">
            <h3>作业规则</h3>
            <ul>
              <li>登记后气瓶进入待充填队列</li>
              <li>检验有效期早于今天不能开始充填，显示原因并留在队列</li>
              <li>同一气瓶已有进行中任务时只提示占用，不产生第二条任务</li>
              <li>签收须填写实际压力、氧含量、充填方式、操作员，且压力达标</li>
            </ul>
          </div>
        </aside>

        <section className="panel form-panel">
          <div className="heading">
            <div>
              <p>气瓶登记</p>
              <h2>新增气瓶</h2>
            </div>
            <button className="primary" onClick={handleRegister}>登记并入队</button>
          </div>
          <div className="field-grid">
            <label>
              <span>气瓶编号 *</span>
              <input value={form.cylinderId} onChange={(e) => updateForm("cylinderId", e.target.value)} placeholder="如 TANK-204" />
            </label>
            <label>
              <span>容积 *</span>
              <input value={form.volume} onChange={(e) => updateForm("volume", e.target.value)} placeholder="如 12L 铝瓶" />
            </label>
            <label>
              <span>检验有效期 *</span>
              <input type="date" value={form.inspectionExpiry} onChange={(e) => updateForm("inspectionExpiry", e.target.value)} />
            </label>
            <label>
              <span>残压 (bar)</span>
              <input type="number" value={form.residualPressure} onChange={(e) => updateForm("residualPressure", e.target.value)} placeholder="如 55，空瓶填 0" />
            </label>
            <label>
              <span>目标压力 (bar) *</span>
              <input type="number" value={form.targetPressure} onChange={(e) => updateForm("targetPressure", e.target.value)} placeholder="如 200" />
            </label>
            <label>
              <span>氦含量 (%)，普通空气/高氧留空</span>
              <input type="number" step="0.1" value={form.heliumPercent} onChange={(e) => updateForm("heliumPercent", e.target.value)} placeholder="Trimix 才需填写" />
            </label>
          </div>
          {formError && <div className="form-error" role="alert">{formError}</div>}
        </section>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>作业队列</p>
            <h2>待充填队列（{queue.length}）</h2>
          </div>
        </div>
        {queue.length === 0 ? (
          <p className="empty-hint">当前筛选下没有待处理气瓶。</p>
        ) : (
          <div className="queue-list">
            {queue
              .slice()
              .sort((a, b) => {
                if (a.status !== b.status) return a.status === "filling" ? -1 : 1;
                return a.createdAt - b.createdAt;
              })
              .map((task) => (
                <QueueCard
                  key={task.id}
                  task={task}
                  blockReason={blockReasons[task.id]}
                  onStart={handleStart}
                  onSignoff={(t) => setSignoffId(t.id)}
                />
              ))}
          </div>
        )}
      </section>

      <HistoryPanel tasks={tasks} />

      {signoffTask && signoffTask.status === "filling" && (
        <SignoffModal
          task={signoffTask}
          onSubmit={handleSignoff}
          onClose={() => setSignoffId(null)}
        />
      )}

      <Toast toast={toast} />
    </main>
  );
}

export default App;
