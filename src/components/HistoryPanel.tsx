import { useState } from "react";
import type { FillTask } from "../types";
import { formatTime } from "../utils";

interface Props {
  tasks: FillTask[];
}

/** 单瓶历史：按气瓶编号查询该瓶全部充填单（含已从队列移除的签收记录） */
export function HistoryPanel({ tasks }: Props) {
  const [query, setQuery] = useState("");

  const keyword = query.trim().toUpperCase();
  const matched = keyword
    ? tasks.filter((t) => t.cylinderId.toUpperCase().includes(keyword))
    : tasks.filter((t) => t.status === "signed");
  const list = [...matched].sort((a, b) => (b.signedAt ?? b.createdAt) - (a.signedAt ?? a.createdAt));

  const signedCount = list.filter((t) => t.status === "signed").length;

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>单瓶追溯</p>
          <h2>气瓶历史记录</h2>
        </div>
        {keyword && <span className="history-count">匹配 {list.length} 单 · 已签收 {signedCount} 单</span>}
      </div>

      <label className="history-search">
        <span>输入气瓶编号查询</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="如 TANK-204，留空显示最近签收记录"
        />
      </label>

      {list.length === 0 ? (
        <p className="empty-hint">未找到该气瓶的记录。</p>
      ) : (
        <div className="history-list">
          {list.map((t) => (
            <article key={t.id} className="history-item">
              <div className="history-head">
                <b>{t.cylinderId}</b>
                <span className={`badge badge-${t.status}`}>
                  {t.status === "queued" ? "待充填" : t.status === "filling" ? "充填中" : "已签收"}
                </span>
                <span className="history-id">单号 {t.id}</span>
              </div>
              <p className="queue-meta">{t.volume}</p>
              <p className="history-line">
                残压 {t.residualPressure}bar → 目标 {t.targetPressure}bar
                {t.heliumPercent > 0 ? ` · 登记 He ${t.heliumPercent}%` : ""}
              </p>
              <p className="history-line">检验有效期 {t.inspectionExpiry}</p>
              {t.status === "signed" ? (
                <div className="history-signoff">
                  <p className="history-line">
                    实际压力 <b>{t.actualPressure}bar</b> · 氧含量 <b>{t.oxygenPercent}%</b>
                    {t.heliumPercent > 0 && ` · He ${t.heliumPercent}%`}
                  </p>
                  <p className="history-line">{t.fillMethod} · 操作员 {t.operator}</p>
                  <p className="queue-time">
                    登记 {formatTime(t.createdAt)}
                    {t.startedAt ? ` · 开始 ${formatTime(t.startedAt)}` : ""}
                    {t.signedAt ? ` · 签收 ${formatTime(t.signedAt)}` : ""}
                  </p>
                </div>
              ) : (
                <p className="queue-time">登记于 {formatTime(t.createdAt)}，尚未签收</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
