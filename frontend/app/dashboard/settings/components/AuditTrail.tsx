"use client";

import { useMemo, useState } from "react";
import { ArrowClockwise, FunnelSimple, ShieldCheck, WarningCircle } from "@phosphor-icons/react";

import { useLanguage } from "../../../../context/LanguageContext";
import { useAuditEvents } from "@/features/settings/hooks/use-audit-events";

interface AuditTrailProps {
  token: string;
}

const PAGE_SIZE = 20;

export default function AuditTrail({ token }: AuditTrailProps) {
  const { language } = useLanguage();
  const isZh = language === "zh";
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);

  const auditQuery = useAuditEvents(token, {
    limit: PAGE_SIZE,
    offset,
    action,
    resourceType,
    status,
  });

  const totalPages = useMemo(() => {
    const total = auditQuery.data?.total || 0;
    return Math.max(Math.ceil(total / PAGE_SIZE), 1);
  }, [auditQuery.data?.total]);

  return (
    <div className="space-y-10 animate-float-up">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shadow-inner">
            <ShieldCheck weight="bold" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight uppercase">
              {isZh ? "审计事件追踪" : "Audit Trail"}
            </h2>
            <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mt-0.5">
              {isZh ? "关键管理动作记录" : "Administrative action records"}
            </p>
          </div>
        </div>
        <button
          className="h-11 px-4 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.07] transition-all text-[11px] uppercase tracking-widest font-bold flex items-center gap-2"
          onClick={() => auditQuery.refetch()}
          disabled={auditQuery.isFetching}
        >
          <ArrowClockwise
            size={16}
            weight="bold"
            className={auditQuery.isFetching ? "animate-spin" : ""}
          />
          {isZh ? "刷新审计" : "Refresh"}
        </button>
      </div>

      <section className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 space-y-6 shadow-inner">
        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
          <FunnelSimple size={16} weight="bold" />
          {isZh ? "审计过滤器" : "Audit Filters"}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            value={action}
            onChange={(event) => {
              setOffset(0);
              setAction(event.target.value);
            }}
            className="!mb-0"
            placeholder={isZh ? "按动作筛选，例如 import_all_configs" : "Filter by action"}
          />
          <input
            value={resourceType}
            onChange={(event) => {
              setOffset(0);
              setResourceType(event.target.value);
            }}
            className="!mb-0"
            placeholder={isZh ? "按资源类型筛选，例如 sign_task" : "Filter by resource type"}
          />
          <select
            value={status}
            onChange={(event) => {
              setOffset(0);
              setStatus(event.target.value);
            }}
            className="w-full"
          >
            <option value="">{isZh ? "全部状态" : "All statuses"}</option>
            <option value="success">{isZh ? "成功" : "Success"}</option>
            <option value="warning">{isZh ? "警告" : "Warning"}</option>
            <option value="error">{isZh ? "失败" : "Error"}</option>
          </select>
        </div>
      </section>

      <section className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 space-y-6 shadow-inner">
        {auditQuery.isLoading ? (
          <div className="text-sm text-white/35">{isZh ? "正在加载审计事件..." : "Loading audit events..."}</div>
        ) : auditQuery.error ? (
          <div className="text-sm text-rose-200">{isZh ? "获取审计事件失败" : "Failed to load audit events"}</div>
        ) : auditQuery.data?.items.length ? (
          <>
            <div className="space-y-4">
              {auditQuery.data.items.map((event) => (
                <div key={event.id} className="rounded-2xl bg-black/20 border border-white/5 px-5 py-4">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`mt-0.5 ${event.status === "success" ? "text-emerald-400" : "text-amber-400"}`}>
                        {event.status === "success" ? (
                          <ShieldCheck weight="fill" size={16} />
                        ) : (
                          <WarningCircle weight="fill" size={16} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{event.action}</div>
                        <div className="text-[11px] text-white/35 mt-1 break-all">
                          {event.resource_type}
                          {event.resource_id ? ` / ${event.resource_id}` : ""}
                          {event.actor ? ` / ${event.actor}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-white/35 font-mono">{event.created_at}</div>
                  </div>
                  {event.details && Object.keys(event.details).length ? (
                    <pre className="mt-4 rounded-2xl bg-black/30 border border-white/5 p-4 text-[11px] text-white/55 overflow-x-auto">
                      {JSON.stringify(event.details, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-4 pt-2">
              <div className="text-xs text-white/35">
                {isZh
                  ? `共 ${auditQuery.data.total} 条记录，第 ${Math.floor(offset / PAGE_SIZE) + 1} / ${totalPages} 页`
                  : `${auditQuery.data.total} events, page ${Math.floor(offset / PAGE_SIZE) + 1} / ${totalPages}`}
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="h-10 px-4 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.07] disabled:opacity-40 transition-all text-[11px] uppercase tracking-widest font-bold"
                  disabled={offset === 0}
                  onClick={() => setOffset((value) => Math.max(value - PAGE_SIZE, 0))}
                >
                  {isZh ? "上一页" : "Prev"}
                </button>
                <button
                  className="h-10 px-4 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.07] disabled:opacity-40 transition-all text-[11px] uppercase tracking-widest font-bold"
                  disabled={offset + PAGE_SIZE >= (auditQuery.data?.total || 0)}
                  onClick={() => setOffset((value) => value + PAGE_SIZE)}
                >
                  {isZh ? "下一页" : "Next"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl bg-black/20 border border-white/5 px-4 py-6 text-sm text-white/30">
            {isZh ? "当前筛选条件下没有审计事件" : "No audit events for the current filters"}
          </div>
        )}
      </section>
    </div>
  );
}
