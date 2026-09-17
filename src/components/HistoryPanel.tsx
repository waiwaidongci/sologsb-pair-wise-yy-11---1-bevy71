import { useMemo, useState } from "react";
import type { FillTask } from "../types";
import { formatDateTime, mixLabel } from "../logic";

interface Props {
  tasks: FillTask[]; // 全部任务（含历史）
}

type MethodFilter = "全部" | "空气" | "高氧" | "Trimix";

export default function HistoryPanel({ tasks }: Props) {
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState<MethodFilter>("全部");

  const signedTasks = useMemo(
    () => tasks.filter((t) => t.status === "done"),
    [tasks],
  );

  const key = query.trim().toUpperCase();
  const filtered = useMemo(() => {
    return signedTasks
      .filter((t) => (key ? t.serial.toUpperCase().includes(key) : true))
      .filter((t) => (method === "全部" ? true : t.fillMethod === method))
      .sort((a, b) => (b.signedAt ?? 0) - (a.signedAt ?? 0));
  }, [signedTasks, key, method]);

  // 单瓶历史：按编号精确汇总
  const perSerial = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of signedTasks) {
      map.set(t.serial, (map.get(t.serial) ?? 0) + 1);
    }
    return map;
  }, [signedTasks]);
  const exactCount = key ? perSerial.get(key) ?? null : null;

  return (
    <section className="panel history-panel">
      <div className="heading">
        <div>
          <p>签收记录 · 单瓶历史</p>
          <h2>气瓶充填档案</h2>
        </div>
      </div>

      <div className="history-toolbar">
        <input
          className="history-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入气瓶编号查询单瓶历史，例如 TANK-204"
        />
        <div className="chips">
          {(["全部", "空气", "高氧", "Trimix"] as MethodFilter[]).map((m) => (
            <button
              key={m}
              type="button"
              className={method === m ? "chip-active" : ""}
              onClick={() => setMethod(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {key && (
        <p className="history-summary">
          {exactCount === null ? (
            <>编号 {key} 暂无已签收的充填记录。</>
          ) : (
            <>
              编号 {key} 共 <b>{exactCount}</b> 次充填签收记录
              {perSerial.get(key) === 1 ? "" : "（按时间倒序）"}。
            </>
          )}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">没有符合条件的签收记录。</div>
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>气瓶编号</th>
                <th>签收时间</th>
                <th>实际压力</th>
                <th>实测气体</th>
                <th>充填方式</th>
                <th>操作员</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td>
                    <b>{t.serial}</b>
                    <small className="cell-sub">{t.volume} L</small>
                  </td>
                  <td>{t.signedAt ? formatDateTime(t.signedAt) : "—"}</td>
                  <td>
                    {t.actualPressure} bar
                    <small className="cell-sub">目标 {t.targetPressure}</small>
                  </td>
                  <td>{mixLabel(t.actualO2 ?? 0, t.actualHe ?? 0)}</td>
                  <td>{t.fillMethod}</td>
                  <td>{t.operator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
