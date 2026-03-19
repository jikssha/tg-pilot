"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  ArrowClockwise,
  CalendarDots,
  CheckCircle,
  Cpu,
  Database,
  Lightning,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";

import { useLanguage } from "../../../../context/LanguageContext";
import { useOperationsOverview } from "@/features/settings/hooks/use-operations-overview";

interface OperationsOverviewProps {
  token: string;
}

export default function OperationsOverview({ token }: OperationsOverviewProps) {
  const { language } = useLanguage();
  const isZh = language === "zh";
  const overviewQuery = useOperationsOverview(token);

  const statusEntries = useMemo(() => {
    const statuses = overviewQuery.data?.accounts.statuses || {};
    return Object.entries(statuses).sort((a, b) => b[1] - a[1]);
  }, [overviewQuery.data?.accounts.statuses]);

  return (
    <div className="space-y-10 animate-float-up">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
            <Cpu weight="bold" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight uppercase">
              {isZh ? "系统运维概览" : "Operations Overview"}
            </h2>
            <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mt-0.5">
              {isZh ? "运行状态与调度摘要" : "Runtime & Scheduler Snapshot"}
            </p>
          </div>
        </div>
        <button
          className="h-11 px-4 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.07] transition-all text-[11px] uppercase tracking-widest font-bold flex items-center gap-2"
          onClick={() => overviewQuery.refetch()}
          disabled={overviewQuery.isFetching}
        >
          {overviewQuery.isFetching ? (
            <ArrowClockwise className="animate-spin" size={16} weight="bold" />
          ) : (
            <ArrowClockwise size={16} weight="bold" />
          )}
          {isZh ? "刷新概览" : "Refresh"}
        </button>
      </div>

      {overviewQuery.isLoading ? (
        <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-10 text-white/40 text-sm">
          {isZh ? "正在加载系统概览..." : "Loading operations overview..."}
        </div>
      ) : overviewQuery.error ? (
        <div className="rounded-3xl bg-rose-500/10 border border-rose-500/20 p-10 text-rose-200 text-sm">
          {isZh ? "获取系统概览失败" : "Failed to load operations overview"}
        </div>
      ) : overviewQuery.data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <MetricCard
              icon={<ShieldCheck size={18} weight="bold" />}
              title={isZh ? "服务就绪状态" : "Readiness"}
              value={overviewQuery.data.readiness.ready ? (isZh ? "已就绪" : "Ready") : (isZh ? "启动中" : "Starting")}
              accent={overviewQuery.data.readiness.ready ? "emerald" : "amber"}
            />
            <MetricCard
              icon={<Lightning size={18} weight="bold" />}
              title={isZh ? "调度器任务数" : "Scheduler Jobs"}
              value={String(overviewQuery.data.scheduler.job_count)}
              accent="cyan"
            />
            <MetricCard
              icon={<Database size={18} weight="bold" />}
              title={isZh ? "账号总数" : "Accounts"}
              value={String(overviewQuery.data.accounts.total)}
              accent="indigo"
            />
            <MetricCard
              icon={<CalendarDots size={18} weight="bold" />}
              title={isZh ? "签到任务总数" : "Sign Tasks"}
              value={String(overviewQuery.data.sign_tasks.total)}
              accent="violet"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <section className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 space-y-6 shadow-inner">
              <header className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    {isZh ? "就绪检查" : "Readiness Checks"}
                  </h3>
                  <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold mt-1">
                    {isZh ? "服务自检快照" : "Service self-check snapshot"}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${overviewQuery.data.readiness.ready ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>
                  {overviewQuery.data.readiness.ready ? "READY" : "STARTING"}
                </span>
              </header>
              <div className="space-y-3">
                {Object.entries(overviewQuery.data.readiness.checks).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-2xl bg-black/20 border border-white/5 px-4 py-3"
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-bold uppercase tracking-widest text-white/60">
                        {key}
                      </div>
                      {overviewQuery.data.readiness.details?.[key] ? (
                        <div className="text-[11px] text-white/30">
                          {overviewQuery.data.readiness.details[key]}
                        </div>
                      ) : null}
                    </div>
                    <div className={`text-xs font-bold ${value ? "text-emerald-400" : "text-amber-400"}`}>
                      {value ? (isZh ? "通过" : "OK") : (isZh ? "待处理" : "Pending")}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 space-y-6 shadow-inner">
              <header>
                <h3 className="text-sm font-bold tracking-tight">
                  {isZh ? "账号状态分布" : "Account Status Distribution"}
                </h3>
                <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold mt-1">
                  {isZh ? "最近一次同步到数据库的状态" : "Last persisted account states"}
                </p>
              </header>
              <div className="space-y-3">
                {statusEntries.length ? (
                  statusEntries.map(([status, count]) => (
                    <div
                      key={status}
                      className="flex items-center justify-between rounded-2xl bg-black/20 border border-white/5 px-4 py-3"
                    >
                      <span className="text-sm font-semibold capitalize">{status}</span>
                      <span className="text-sm font-black text-white/70">{count}</span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-black/20 border border-white/5 px-4 py-6 text-sm text-white/30">
                    {isZh ? "暂无账号状态数据" : "No account status data yet"}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <section className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 space-y-6 shadow-inner">
              <header>
                <h3 className="text-sm font-bold tracking-tight">
                  {isZh ? "签到任务运行摘要" : "Sign Task Summary"}
                </h3>
                <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold mt-1">
                  {isZh ? "数据库中的最近运行结果" : "Recent persisted execution state"}
                </p>
              </header>
              <div className="grid grid-cols-2 gap-4">
                <MiniMetric label={isZh ? "启用中" : "Enabled"} value={overviewQuery.data.sign_tasks.enabled} tone="emerald" />
                <MiniMetric label={isZh ? "已禁用" : "Disabled"} value={overviewQuery.data.sign_tasks.disabled} tone="slate" />
                <MiniMetric label={isZh ? "最近成功" : "Last Success"} value={overviewQuery.data.sign_tasks.last_run_success} tone="cyan" />
                <MiniMetric label={isZh ? "最近失败" : "Last Failed"} value={overviewQuery.data.sign_tasks.last_run_failed} tone="rose" />
              </div>
              <div className="rounded-2xl bg-black/20 border border-white/5 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-white/50">{isZh ? "尚未运行" : "Never Run"}</span>
                <span className="text-lg font-black text-amber-300">{overviewQuery.data.sign_tasks.never_run}</span>
              </div>
            </section>

            <section className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 space-y-6 shadow-inner">
              <header className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    {isZh ? "调度器与最近审计" : "Scheduler & Recent Audit"}
                  </h3>
                  <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold mt-1">
                    {isZh ? "最新任务调度与管理动作" : "Latest jobs and admin actions"}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${overviewQuery.data.scheduler.running ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                  {overviewQuery.data.scheduler.running ? "RUNNING" : "STOPPED"}
                </span>
              </header>
              <div className="space-y-3">
                {overviewQuery.data.scheduler.jobs.length ? (
                  overviewQuery.data.scheduler.jobs.slice(0, 5).map((job) => (
                    <div key={job.id} className="rounded-2xl bg-black/20 border border-white/5 px-4 py-3">
                      <div className="text-sm font-semibold">{job.id}</div>
                      <div className="text-[11px] text-white/35 mt-1">
                        {job.next_run_time || (isZh ? "暂无下一次执行时间" : "No next run time")}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-black/20 border border-white/5 px-4 py-6 text-sm text-white/30">
                    {isZh ? "当前没有已注册的调度任务" : "No scheduler jobs are currently registered"}
                  </div>
                )}
              </div>
              <div className="border-t border-white/5 pt-4 space-y-3">
                {overviewQuery.data.recent_audit.length ? (
                  overviewQuery.data.recent_audit.slice(0, 3).map((event) => (
                    <div key={event.id} className="flex items-start gap-3">
                      <div className={`mt-0.5 ${event.status === "success" ? "text-emerald-400" : "text-amber-400"}`}>
                        {event.status === "success" ? <CheckCircle size={16} weight="fill" /> : <WarningCircle size={16} weight="fill" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{event.action}</div>
                        <div className="text-[11px] text-white/35 truncate">
                          {event.resource_type}
                          {event.resource_id ? ` / ${event.resource_id}` : ""}
                          {event.actor ? ` / ${event.actor}` : ""}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-white/30">
                    {isZh ? "暂无审计事件" : "No audit events yet"}
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  icon,
  title,
  value,
  accent,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  accent: "emerald" | "amber" | "cyan" | "indigo" | "violet";
}) {
  const tones = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  } as const;

  return (
    <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-6 shadow-inner">
      <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${tones[accent]}`}>{icon}</div>
      <div className="mt-5 text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold">{title}</div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "slate" | "cyan" | "rose";
}) {
  const toneClass = {
    emerald: "text-emerald-300 bg-emerald-500/5 border-emerald-500/10",
    slate: "text-white/70 bg-white/[0.03] border-white/10",
    cyan: "text-cyan-300 bg-cyan-500/5 border-cyan-500/10",
    rose: "text-rose-300 bg-rose-500/5 border-rose-500/10",
  } as const;

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClass[tone]}`}>
      <div className="text-[10px] uppercase tracking-widest font-bold opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}
