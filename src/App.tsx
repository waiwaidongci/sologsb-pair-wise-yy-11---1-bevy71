import { useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import type { FillTask, RegisterInput } from "./types";
import {
  findOccupyingTask,
  formatDateTime,
  isExpired,
  loadTasks,
  newId,
  saveTasks,
} from "./logic";
import RegisterForm from "./components/RegisterForm";
import FillQueue from "./components/FillQueue";
import SignoffModal from "./components/SignoffModal";
import HistoryPanel from "./components/HistoryPanel";
import Toasts, { type ToastData, type ToastKind } from "./components/Toasts";

function App() {
  const [tasks, setTasks] = useState<FillTask[]>(() => loadTasks());
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [signoffTask, setSignoffTask] = useState<FillTask | null>(null);
  const toastSeq = useRef(0);
  // 每次渲染同步最新任务，事件处理器通过 ref 读取，杜绝闭包旧状态
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  // 最近一次登记的气瓶 ID 与信息，effect 在提交后读取最终状态决定提示内容
  const lastRegister = useRef<{ id: string; serial: string; inspectionDate: string } | null>(null);
  const [registerSignal, setRegisterSignal] = useState(0);

  // 刷新后状态保留：所有变更写回 localStorage
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  // 登记结果提示：在渲染提交后执行，读到的必为包含新任务的最终状态
  useEffect(() => {
    if (registerSignal === 0 || !lastRegister.current) return;
    const { id, serial, inspectionDate } = lastRegister.current;
    if (isExpired(inspectionDate)) {
      pushToast(
        "error",
        `${serial} 已入队，但检验有效期 ${inspectionDate} 早于今天，不能开始充填。`,
      );
    } else if (findOccupyingTask(tasksRef.current, serial, id)) {
      pushToast(
        "info",
        `${serial} 已入队；该气瓶已有进行中的充填任务，需签收后才能再次开始。`,
      );
    } else {
      pushToast("success", `${serial} 已登记并进入待充填队列。`);
    }
  }, [registerSignal]);

  function pushToast(kind: ToastKind, message: string) {
    const id = ++toastSeq.current;
    setToasts((list) => [...list, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 4200);
  }

  // 弹窗里的任务对象要随 tasks 更新（签收后用于渲染的是快照，关闭即清空）
  useEffect(() => {
    if (!signoffTask) return;
    const latest = tasks.find((t) => t.id === signoffTask.id);
    if (latest && latest.status === "filling") {
      setSignoffTask(latest);
    }
  }, [tasks, signoffTask]);

  const activeTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== "done")
        .sort((a, b) => a.createdAt - b.createdAt),
    [tasks],
  );

  const busySerials = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      if (t.status === "filling") set.add(t.serial.trim().toUpperCase());
    }
    return set;
  }, [tasks]);

  const metrics = useMemo(() => {
    const queued = tasks.filter((t) => t.status === "queued").length;
    const filling = tasks.filter((t) => t.status === "filling").length;
    const expired = tasks.filter(
      (t) => t.status !== "done" && isExpired(t.inspectionDate),
    ).length;
    const done = tasks.filter((t) => t.status === "done").length;
    return [
      { label: "待充填", value: queued },
      { label: "充填中", value: filling },
      { label: "过期不可充填", value: expired },
      { label: "已签收（累计）", value: done },
    ];
  }, [tasks]);

  function handleRegister(input: RegisterInput) {
    const task: FillTask = {
      id: newId(),
      serial: input.serial,
      volume: input.volume,
      inspectionDate: input.inspectionDate,
      residualPressure: input.residualPressure,
      targetPressure: input.targetPressure,
      targetO2: input.targetO2,
      targetHe: input.targetHe,
      status: "queued",
      createdAt: Date.now(),
      startedAt: null,
      actualPressure: null,
      actualO2: null,
      actualHe: null,
      fillMethod: null,
      operator: "",
      signedAt: null,
    };

    // 提示内容在提交后的 effect 中依据最终状态生成（过期 / 已占用 / 正常入队）
    lastRegister.current = {
      id: task.id,
      serial: task.serial,
      inspectionDate: task.inspectionDate,
    };
    setTasks((list) => [...list, task]);
    setRegisterSignal((n) => n + 1);
  }

  function handleStart(task: FillTask) {
    // 规则 1：检验有效期早于今天 → 不能开始，显示原因，留在队列
    if (isExpired(task.inspectionDate)) {
      pushToast(
        "error",
        `无法开始：${task.serial} 的检验有效期 ${task.inspectionDate} 已过期，请先送检。气瓶保留在队列中。`,
      );
      return;
    }

    // 规则 2：同一气瓶已有进行中任务 → 只提示占用，不产生第二条任务
    const occupied = findOccupyingTask(tasksRef.current, task.serial, task.id);
    if (occupied) {
      const since = occupied.startedAt ? `（开始于 ${formatDateTime(occupied.startedAt)}）` : "";
      pushToast(
        "error",
        `${task.serial} 已被进行中的充填任务占用${since}，不能重复开始，也不会生成第二条任务。`,
      );
      return;
    }

    setTasks((list) =>
      list.map((t) =>
        t.id === task.id ? { ...t, status: "filling" as const, startedAt: Date.now() } : t,
      ),
    );
    pushToast("success", `${task.serial} 开始充填，请监控压力与气体配比。`);
  }

  function handleFinish(task: FillTask) {
    setSignoffTask(task);
  }

  function handleSignoffConfirm(values: {
    actualPressure: number;
    actualO2: number;
    actualHe: number;
    fillMethod: FillTask["fillMethod"];
    operator: string;
  }) {
    const current = signoffTask;
    setTasks((list) =>
      list.map((t) =>
        t.id === current?.id
          ? {
              ...t,
              status: "done",
              actualPressure: values.actualPressure,
              actualO2: values.actualO2,
              actualHe: values.actualHe,
              fillMethod: values.fillMethod,
              operator: values.operator,
              signedAt: Date.now(),
            }
          : t,
      ),
    );
    setSignoffTask(null);
    pushToast(
      "success",
      `${current?.serial ?? "气瓶"} 已签收，记录实际压力 ${values.actualPressure} bar、O₂ ${values.actualO2}%，并移出待充填队列。`,
    );
  }

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62010 · 潜水店气瓶充填工作台</p>
        <h1>潜水气瓶充填记录</h1>
        <span>
          登记入队 → 检验有效期核验 → 开始充填 → 填写实际参数签收。过期气瓶禁止开始，
          同一气瓶进行中不可重复充填，签收信息不齐不放行；签收后气瓶移出队列，单瓶历史随时可查。
        </span>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label} className={m.label.includes("过期") && m.value > 0 ? "metric-alert" : ""}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      <section className="workspace">
        <aside className="panel flow-panel">
          <h2>操作流程</h2>
          <ol className="flow-steps">
            <li>
              <b>1. 登记气瓶</b>
              <span>填写编号、容积、检验有效期、残压/目标压力与目标气体，登记后进入待充填队列。</span>
            </li>
            <li>
              <b>2. 核验后开始</b>
              <span>检验有效期早于今天的气瓶不能开始充填，原因直接标在卡片上并留在队列。</span>
            </li>
            <li>
              <b>3. 单瓶单任务</b>
              <span>同一气瓶已有进行中任务时，再次开始只提示已占用，不会产生第二条任务或半成品。</span>
            </li>
            <li>
              <b>4. 核验签收</b>
              <span>结束时必须填写实际压力、氧含量、充填方式和操作员；信息不齐或不达标不能签收。</span>
            </li>
            <li>
              <b>5. 历史可查</b>
              <span>签收后移出待充填队列，单瓶历史仍可在下方档案中查询，刷新页面状态保留。</span>
            </li>
          </ol>
        </aside>

        <RegisterForm onRegister={handleRegister} />
      </section>

      <FillQueue
        tasks={activeTasks}
        busySerials={busySerials}
        onStart={handleStart}
        onFinish={handleFinish}
      />

      <HistoryPanel tasks={tasks} />

      {signoffTask && (
        <SignoffModal
          task={signoffTask}
          onCancel={() => setSignoffTask(null)}
          onConfirm={handleSignoffConfirm}
        />
      )}

      <Toasts toasts={toasts} />
    </main>
  );
}

export default App;
