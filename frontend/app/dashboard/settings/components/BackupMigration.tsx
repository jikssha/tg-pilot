"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUDownLeft,
  CloudArrowUp,
  Database,
  FileArchive,
  FileCode,
  FloppyDisk,
  GithubLogo,
  Info,
  Spinner,
} from "@phosphor-icons/react";

import { useLanguage } from "../../../../context/LanguageContext";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import {
  ConfigBundlePreview,
  exportAllConfigs,
  exportSessionsZip,
  GlobalSettings,
  importAllConfigs,
  importSessionsZip,
  previewAllConfigsImport,
  previewSessionsZip,
  saveGlobalSettings,
  SessionBundlePreview,
} from "../../../../lib/api";

interface BackupMigrationProps {
  token: string;
  globalSettings: GlobalSettings;
  loadGlobalSettings: (token: string) => Promise<void>;
}

type FeedbackState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

export default function BackupMigration({
  token,
  globalSettings,
  loadGlobalSettings,
}: BackupMigrationProps) {
  const { language } = useLanguage();
  const isZh = language === "zh";

  const [loading, setLoading] = useState(false);
  const [exportingSessions, setExportingSessions] = useState(false);
  const [previewingSessions, setPreviewingSessions] = useState(false);
  const [importingSessions, setImportingSessions] = useState(false);
  const [exportingConfig, setExportingConfig] = useState(false);
  const [previewingConfig, setPreviewingConfig] = useState(false);
  const [importingConfig, setImportingConfig] = useState(false);
  const [showSessionImportConfirm, setShowSessionImportConfirm] = useState(false);
  const [showConfigImportConfirm, setShowConfigImportConfirm] = useState(false);
  const [pendingSessionFile, setPendingSessionFile] = useState<File | null>(null);
  const [pendingConfigJson, setPendingConfigJson] = useState<string>("");
  const [pendingConfigFileName, setPendingConfigFileName] = useState<string>("");
  const [sessionPreview, setSessionPreview] = useState<SessionBundlePreview | null>(null);
  const [configPreview, setConfigPreview] = useState<ConfigBundlePreview | null>(null);
  const [overwriteConfigImport, setOverwriteConfigImport] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const [settings, setSettings] = useState<GlobalSettings>(globalSettings);

  useEffect(() => {
    setSettings(globalSettings);
  }, [globalSettings]);

  const sessionPreviewSummary = useMemo(() => {
    if (!sessionPreview) return "";
    const accounts = sessionPreview.account_names.length;
    const files = sessionPreview.file_count;
    return isZh
      ? `检测到 ${files} 个会话文件，覆盖 ${accounts} 个账号。`
      : `${files} session files detected for ${accounts} accounts.`;
  }, [isZh, sessionPreview]);

  const configPreviewSummary = useMemo(() => {
    if (!configPreview) return "";
    const signTasks = configPreview.sign_tasks.total;
    const monitors = configPreview.monitor_tasks.total;
    const settingsCount = configPreview.settings.count;
    return isZh
      ? `检测到 ${signTasks} 个签到任务、${monitors} 个监控任务、${settingsCount} 个设置段。`
      : `${signTasks} sign tasks, ${monitors} monitor tasks, and ${settingsCount} settings sections detected.`;
  }, [configPreview, isZh]);

  const setSuccess = (message: string) => setFeedback({ type: "success", message });
  const setError = (message: string) => setFeedback({ type: "error", message });
  const setInfo = (message: string) => setFeedback({ type: "info", message });

  const handleSaveGlobal = async () => {
    if (!token) return;
    try {
      setLoading(true);
      await saveGlobalSettings(token, settings);
      await loadGlobalSettings(token);
      setSuccess(isZh ? "系统参数已保存" : "System settings saved");
    } catch (err: any) {
      setError(err?.message || (isZh ? "保存失败" : "Save failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleExportSessions = async () => {
    if (!token) return;
    try {
      setExportingSessions(true);
      const blob = await exportSessionsZip(token);
      downloadBlob(blob, `tg_pilot_sessions_${new Date().toISOString().split("T")[0]}.zip`);
      setSuccess(isZh ? "会话压缩包已导出" : "Session bundle exported");
    } catch (err: any) {
      setError(err?.message || (isZh ? "导出失败" : "Export failed"));
    } finally {
      setExportingSessions(false);
    }
  };

  const handleExportConfigs = async () => {
    if (!token) return;
    try {
      setExportingConfig(true);
      const payload = await exportAllConfigs(token);
      downloadText(payload, `tg_pilot_config_bundle_${new Date().toISOString().split("T")[0]}.json`);
      setSuccess(isZh ? "全量配置包已导出" : "Configuration bundle exported");
    } catch (err: any) {
      setError(err?.message || (isZh ? "配置导出失败" : "Config export failed"));
    } finally {
      setExportingConfig(false);
    }
  };

  const handleImportFileChanged = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!token || !file) return;

    try {
      setPreviewingSessions(true);
      setPendingSessionFile(file);
      const preview = await previewSessionsZip(token, file);
      setSessionPreview(preview);
      setShowSessionImportConfirm(true);
      setInfo(
        isZh
          ? "会话包预检完成，请确认后再执行恢复。"
          : "Session bundle preview is ready. Confirm before restore."
      );
    } catch (err: any) {
      setPendingSessionFile(null);
      setSessionPreview(null);
      setError(err?.message || (isZh ? "会话包预检失败" : "Failed to preview session bundle"));
    } finally {
      setPreviewingSessions(false);
    }
  };

  const confirmImportSessions = async () => {
    if (!token || !pendingSessionFile) return;
    try {
      setImportingSessions(true);
      await importSessionsZip(token, pendingSessionFile);
      setSuccess(isZh ? "会话恢复成功，页面即将刷新。" : "Session restore complete. Reloading...");
      setShowSessionImportConfirm(false);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err: any) {
      setError(err?.message || (isZh ? "会话恢复失败" : "Session restore failed"));
    } finally {
      setImportingSessions(false);
      setPendingSessionFile(null);
      setSessionPreview(null);
    }
  };

  const handleConfigFileChanged = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!token || !file) return;

    try {
      setPreviewingConfig(true);
      const text = await file.text();
      const preview = await previewAllConfigsImport(token, text, overwriteConfigImport);
      setPendingConfigJson(text);
      setPendingConfigFileName(file.name);
      setConfigPreview(preview);
      setShowConfigImportConfirm(true);
      setInfo(
        isZh
          ? "配置包预检完成，请确认导入策略。"
          : "Configuration bundle preview is ready. Review before import."
      );
    } catch (err: any) {
      setPendingConfigJson("");
      setPendingConfigFileName("");
      setConfigPreview(null);
      setError(err?.message || (isZh ? "配置包预检失败" : "Failed to preview config bundle"));
    } finally {
      setPreviewingConfig(false);
    }
  };

  const confirmImportConfigs = async () => {
    if (!token || !pendingConfigJson) return;
    try {
      setImportingConfig(true);
      const result = await importAllConfigs(token, pendingConfigJson, overwriteConfigImport);
      setSuccess(
        isZh
          ? `配置导入完成：签到 ${result.signs_imported} 个，监控 ${result.monitors_imported} 个。`
          : `Config import completed: ${result.signs_imported} sign tasks and ${result.monitors_imported} monitor tasks.`
      );
      setShowConfigImportConfirm(false);
      setConfigPreview(null);
      setPendingConfigJson("");
      setPendingConfigFileName("");
    } catch (err: any) {
      setError(err?.message || (isZh ? "配置导入失败" : "Config import failed"));
    } finally {
      setImportingConfig(false);
    }
  };

  return (
    <div className="space-y-16 animate-float-up">
      <section className="space-y-8">
        <div className="flex items-center gap-4 pb-4 border-b border-white/5">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 shadow-inner">
            <Database weight="bold" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight uppercase">
              {isZh ? "数据管理与系统设置" : "Backup & Runtime Settings"}
            </h2>
            <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mt-0.5">
              {isZh ? "先预检，再恢复" : "Preview first, restore second"}
            </p>
          </div>
        </div>

        {feedback ? (
          <div
            className={`rounded-2xl border px-5 py-4 text-sm ${
              feedback.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-100"
                : feedback.type === "error"
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-100"
                  : "bg-white/[0.03] border-white/10 text-white/70"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 flex flex-col gap-8 shadow-inner bg-gradient-to-br from-indigo-500/[0.03] to-transparent">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                <FileArchive weight="bold" size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">{isZh ? "会话备份恢复" : "Session Bundle"}</h3>
                <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold mt-0.5">
                  {isZh ? "账号登录会话归档" : "Session archive flow"}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-white/40 leading-relaxed">
              {isZh
                ? "导出全部账号会话，并在导入前先读取 manifest 和文件清单，避免盲目覆盖。"
                : "Export every account session and preview manifest/file contents before replacing existing data."}
            </p>

            <div className="space-y-3 text-[11px] text-white/35">
              <div className="rounded-2xl bg-black/20 border border-white/5 px-4 py-3 flex items-center justify-between">
                <span>{isZh ? "预检流程" : "Preview Flow"}</span>
                <span className="font-bold text-indigo-300">{isZh ? "已启用" : "Enabled"}</span>
              </div>
              {sessionPreview ? (
                <PreviewCard
                  title={isZh ? "最近一次预检摘要" : "Latest Preview Snapshot"}
                  body={sessionPreviewSummary}
                  lines={[
                    sessionPreview.metadata.exported_at
                      ? `${isZh ? "导出时间" : "Exported"}: ${sessionPreview.metadata.exported_at}`
                      : null,
                    sessionPreview.metadata.payload_type
                      ? `${isZh ? "载荷类型" : "Payload"}: ${sessionPreview.metadata.payload_type}`
                      : null,
                    sessionPreview.file_names.length
                      ? `${isZh ? "示例文件" : "Sample files"}: ${sessionPreview.file_names.join(", ")}`
                      : null,
                  ]}
                  warningLines={sessionPreview.warnings}
                />
              ) : null}
            </div>

            <div className="flex gap-4">
              <button
                className="flex-1 h-12 rounded-xl border border-white/5 bg-white/[0.02] text-white/40 text-[11px] font-bold uppercase tracking-widest hover:bg-white/[0.05] hover:text-white transition-all flex items-center justify-center gap-3"
                onClick={handleExportSessions}
                disabled={exportingSessions}
              >
                {exportingSessions ? (
                  <Spinner className="animate-spin" />
                ) : (
                  <>
                    <CloudArrowUp size={18} weight="bold" className="text-indigo-400" />
                    {isZh ? "下载会话包" : "Export"}
                  </>
                )}
              </button>
              <label className="flex-1">
                <div
                  className={`h-12 rounded-xl border border-white/5 bg-white/[0.02] text-white/40 text-[11px] font-bold uppercase tracking-widest hover:bg-white/[0.05] hover:text-white transition-all flex items-center justify-center gap-3 cursor-pointer ${
                    previewingSessions || importingSessions ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {previewingSessions ? (
                    <Spinner className="animate-spin" />
                  ) : (
                    <>
                      <ArrowUDownLeft size={18} weight="bold" className="text-emerald-400" />
                      {isZh ? "预检并恢复" : "Preview & Restore"}
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handleImportFileChanged}
                  disabled={previewingSessions || importingSessions}
                />
              </label>
            </div>
          </div>

          <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 flex flex-col gap-8 shadow-inner bg-gradient-to-br from-cyan-500/[0.03] to-transparent">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                <FileCode weight="bold" size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">{isZh ? "全量配置包" : "Config Bundle"}</h3>
                <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold mt-0.5">
                  {isZh ? "任务与设置统一迁移" : "Task and settings bundle"}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-white/40 leading-relaxed">
              {isZh
                ? "导出完整任务与设置配置；导入前会计算冲突数量，并告诉你本次会跳过还是覆盖哪些内容。"
                : "Export the full task/settings bundle; preview import conflicts before deciding whether to skip or overwrite."}
            </p>

            <div className="space-y-4 text-[11px] text-white/35">
              <label className="flex items-center justify-between rounded-2xl bg-black/20 border border-white/5 px-4 py-3 cursor-pointer">
                <span>{isZh ? "导入时覆盖已有任务" : "Overwrite existing tasks on import"}</span>
                <input
                  type="checkbox"
                  className="!w-5 !h-5 accent-cyan-500"
                  checked={overwriteConfigImport}
                  onChange={(event) => setOverwriteConfigImport(event.target.checked)}
                />
              </label>
              {configPreview ? (
                <PreviewCard
                  title={pendingConfigFileName || (isZh ? "最近一次配置包预检" : "Latest bundle preview")}
                  body={configPreviewSummary}
                  lines={[
                    configPreview.metadata.exported_at
                      ? `${isZh ? "导出时间" : "Exported"}: ${configPreview.metadata.exported_at}`
                      : null,
                    `${isZh ? "签到任务" : "Sign tasks"}: ${configPreview.sign_tasks.importable}/${configPreview.sign_tasks.total}`,
                    `${isZh ? "监控任务" : "Monitor tasks"}: ${configPreview.monitor_tasks.importable}/${configPreview.monitor_tasks.total}`,
                    configPreview.settings.sections.length
                      ? `${isZh ? "设置段" : "Settings"}: ${configPreview.settings.sections.join(", ")}`
                      : null,
                  ]}
                  warningLines={[
                    ...configPreview.sign_tasks.conflict_names.map((item) =>
                      `${isZh ? "签到冲突" : "Sign conflict"}: ${item}`
                    ),
                    ...configPreview.monitor_tasks.conflict_names.map((item) =>
                      `${isZh ? "监控冲突" : "Monitor conflict"}: ${item}`
                    ),
                    ...configPreview.warnings,
                  ]}
                />
              ) : null}
            </div>

            <div className="flex gap-4">
              <button
                className="flex-1 h-12 rounded-xl border border-white/5 bg-white/[0.02] text-white/40 text-[11px] font-bold uppercase tracking-widest hover:bg-white/[0.05] hover:text-white transition-all flex items-center justify-center gap-3"
                onClick={handleExportConfigs}
                disabled={exportingConfig}
              >
                {exportingConfig ? (
                  <Spinner className="animate-spin" />
                ) : (
                  <>
                    <CloudArrowUp size={18} weight="bold" className="text-cyan-400" />
                    {isZh ? "下载配置包" : "Export"}
                  </>
                )}
              </button>
              <label className="flex-1">
                <div
                  className={`h-12 rounded-xl border border-white/5 bg-white/[0.02] text-white/40 text-[11px] font-bold uppercase tracking-widest hover:bg-white/[0.05] hover:text-white transition-all flex items-center justify-center gap-3 cursor-pointer ${
                    previewingConfig || importingConfig ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {previewingConfig ? (
                    <Spinner className="animate-spin" />
                  ) : (
                    <>
                      <ArrowUDownLeft size={18} weight="bold" className="text-cyan-300" />
                      {isZh ? "预检并导入" : "Preview & Import"}
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleConfigFileChanged}
                  disabled={previewingConfig || importingConfig}
                />
              </label>
            </div>
          </div>

          <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 flex flex-col gap-10 shadow-inner">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 shadow-inner">
                <Info weight="bold" size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">{isZh ? "系统参数设置" : "Runtime Settings"}</h3>
                <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold mt-0.5">
                  {isZh ? "日志与频率控制" : "Retention and execution cadence"}
                </p>
              </div>
            </div>

            <div className="space-y-8 flex-1">
              <div className="space-y-3">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                    {isZh ? "日志保留天数" : "Log Retention"}
                  </label>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase">
                    {settings.log_retention_days || 7} {isZh ? "天" : "Days"}
                  </span>
                </div>
                <input
                  type="number"
                  className="!h-12 bg-black/40 border-white/5 focus:border-indigo-500/30 transition-all rounded-xl px-5 font-mono"
                  placeholder={isZh ? "默认 7 天" : "Default 7 days"}
                  value={settings.log_retention_days || ""}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      log_retention_days: parseInt(event.target.value, 10) || 0,
                    })
                  }
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest ml-1">
                  {isZh ? "全局签到频率（秒）" : "Global Sign Interval (SEC)"}
                </label>
                <input
                  type="number"
                  className="!h-12 bg-black/40 border-white/5 focus:border-indigo-500/30 transition-all rounded-xl px-5 font-mono"
                  placeholder={isZh ? "留空即随机 1-120 秒" : "Leave empty for random 1-120s"}
                  value={settings.sign_interval || ""}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      sign_interval: parseInt(event.target.value, 10) || null,
                    })
                  }
                />
              </div>

              <div className="rounded-2xl bg-black/20 border border-white/5 px-4 py-4 text-[11px] text-white/35 leading-relaxed">
                {isZh
                  ? "这一组参数会立即影响日志清理与默认签到节奏，但不会改变已单独设置的任务时间窗口。"
                  : "These parameters affect log cleanup and default cadence immediately, without overwriting task-specific time windows."}
              </div>

              <div className="h-px bg-white/5" />

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-white/40 shadow-inner">
                    <GithubLogo size={18} weight="bold" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold tracking-tight">
                      {isZh ? "版本更新提醒" : "Version Update Prompt"}
                    </div>
                    <p className="text-[10px] text-white/25 uppercase tracking-[0.18em] font-bold mt-0.5">
                      {isZh ? "默认跟踪上游 release" : "Track upstream releases by default"}
                    </p>
                  </div>
                </div>

                <label className="flex items-center justify-between rounded-2xl bg-black/20 border border-white/5 px-4 py-3 cursor-pointer">
                  <span className="text-[11px] text-white/60">
                    {isZh ? "在主界面显示新版本更新提示" : "Show update banner on dashboard"}
                  </span>
                  <input
                    type="checkbox"
                    className="!w-5 !h-5 accent-emerald-500"
                    checked={Boolean(settings.update_check_enabled ?? true)}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        update_check_enabled: event.target.checked,
                      }))
                    }
                  />
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest ml-1">
                      {isZh ? "上游仓库 Owner" : "Upstream Owner"}
                    </label>
                    <input
                      type="text"
                      className="!h-12 bg-black/40 border-white/5 focus:border-emerald-500/30 transition-all rounded-xl px-5 font-mono disabled:opacity-50"
                      placeholder="jikssha"
                      disabled={!Boolean(settings.update_check_enabled ?? true)}
                      value={settings.update_repo_owner || ""}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          update_repo_owner: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest ml-1">
                      {isZh ? "上游仓库 Repo" : "Upstream Repo"}
                    </label>
                    <input
                      type="text"
                      className="!h-12 bg-black/40 border-white/5 focus:border-emerald-500/30 transition-all rounded-xl px-5 font-mono disabled:opacity-50"
                      placeholder="tg-pilot"
                      disabled={!Boolean(settings.update_check_enabled ?? true)}
                      value={settings.update_repo_name || ""}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          update_repo_name: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/10 px-4 py-4 text-[11px] text-emerald-100/70 leading-relaxed">
                  {isZh
                    ? "默认上游为 jikssha/tg-pilot。fork 用户如果不改这里，就会在主界面继续看到你的上游新版本提示。"
                    : "The default upstream is jikssha/tg-pilot. Fork deployments will keep following your upstream releases unless they change it here."}
                </div>
              </div>
            </div>

            <button
              className="w-full linear-btn-primary h-12 font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
              onClick={handleSaveGlobal}
              disabled={loading}
            >
              {loading ? (
                <Spinner className="animate-spin" />
              ) : (
                <>
                  <FloppyDisk size={18} weight="bold" /> {isZh ? "保存系统参数" : "Save Runtime Settings"}
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={showSessionImportConfirm}
        title={isZh ? "确认恢复会话包" : "Confirm Session Restore"}
        description={
          sessionPreviewSummary ||
          (isZh ? "恢复会话数据将覆盖当前登录状态。" : "Restoring sessions will replace the current login state.")
        }
        hint={
          sessionPreview?.metadata.exported_at
            ? `${isZh ? "导出时间" : "Exported"}: ${sessionPreview.metadata.exported_at}`
            : isZh
              ? "恢复前已完成预检"
              : "Preview completed before restore"
        }
        icon={
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-inner">
            <FileArchive weight="bold" size={20} />
          </div>
        }
        cancelLabel={isZh ? "取消" : "Cancel"}
        confirmLabel={isZh ? "确认恢复" : "Restore Now"}
        onCancel={() => {
          setShowSessionImportConfirm(false);
          setPendingSessionFile(null);
          setSessionPreview(null);
        }}
        onConfirm={confirmImportSessions}
        cancelDisabled={importingSessions}
        confirmDisabled={importingSessions}
        confirmIcon={importingSessions ? <Spinner className="animate-spin text-white" /> : <ArrowUDownLeft weight="bold" size={16} />}
      />

      <ConfirmDialog
        open={showConfigImportConfirm}
        title={isZh ? "确认导入配置包" : "Confirm Config Import"}
        description={
          configPreviewSummary ||
          (isZh ? "导入配置包将写入任务和系统设置。" : "Importing the bundle will write tasks and system settings.")
        }
        hint={
          overwriteConfigImport
            ? isZh
              ? "已启用覆盖模式"
              : "Overwrite mode enabled"
            : isZh
              ? "冲突项将默认跳过"
              : "Conflicts will be skipped by default"
        }
        icon={
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
            <FileCode weight="bold" size={20} />
          </div>
        }
        cancelLabel={isZh ? "取消" : "Cancel"}
        confirmLabel={isZh ? "确认导入" : "Import Bundle"}
        onCancel={() => {
          setShowConfigImportConfirm(false);
          setConfigPreview(null);
          setPendingConfigJson("");
          setPendingConfigFileName("");
        }}
        onConfirm={confirmImportConfigs}
        cancelDisabled={importingConfig}
        confirmDisabled={importingConfig}
        confirmIcon={importingConfig ? <Spinner className="animate-spin text-white" /> : <ArrowUDownLeft weight="bold" size={16} />}
      />
    </div>
  );
}

function PreviewCard({
  title,
  body,
  lines,
  warningLines,
}: {
  title: string;
  body: string;
  lines: Array<string | null>;
  warningLines?: string[];
}) {
  return (
    <div className="rounded-2xl bg-black/20 border border-white/5 p-4 space-y-3">
      <div>
        <div className="text-xs font-bold">{title}</div>
        <div className="text-[11px] text-white/35 mt-1">{body}</div>
      </div>
      <div className="space-y-1 text-[11px] text-white/45">
        {lines.filter(Boolean).map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
      {warningLines?.length ? (
        <div className="pt-2 border-t border-white/5 space-y-1 text-[11px] text-amber-200">
          {warningLines.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  downloadBlob(blob, filename);
}
