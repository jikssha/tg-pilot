"use client";

import { useState } from "react";
import { 
    Database, 
    Spinner, 
    FileArchive, 
    CloudArrowUp,
    FloppyDisk,
    SignOut,
    CheckCircle,
    Info,
    ArrowUDownLeft,
    Clock,
    X,
    ArrowClockwise
} from "@phosphor-icons/react";
import { useLanguage } from "../../../../context/LanguageContext";
import { useToast } from "../../../../components/ui/toast";
import { 
    GlobalSettings, 
    saveGlobalSettings, 
    exportSessionsZip, 
    importSessionsZip 
} from "../../../../lib/api";

interface BackupMigrationProps {
    token: string;
    globalSettings: GlobalSettings;
    loadGlobalSettings: (token: string) => Promise<void>;
}

export default function BackupMigration({ token, globalSettings, loadGlobalSettings }: BackupMigrationProps) {
    const { t, language } = useLanguage();
    const isZh = language === "zh";
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [showImportConfirm, setShowImportConfirm] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);

    const [settings, setSettings] = useState<GlobalSettings>(globalSettings);

    const formatErrorMessage = (key: string, err?: any) => {
        const base = t(key);
        const code = err?.code;
        return code ? `${base} (${code})` : base;
    };

    const handleSaveGlobal = async () => {
        if (!token) return;
        try {
            setLoading(true);
            await saveGlobalSettings(token, settings);
            addToast(t("global_save_success"), "success");
            loadGlobalSettings(token);
        } catch (err: any) {
            addToast(formatErrorMessage("save_failed", err), "error");
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        if (!token) return;
        try {
            setExporting(true);
            const blob = await exportSessionsZip(token);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `tg_pilot_sessions_${new Date().toISOString().split('T')[0]}.zip`;
            a.click();
            URL.revokeObjectURL(url);
            addToast(isZh ? "会话压缩包导出成功" : "Sessions exported", "success");
        } catch (err: any) {
            addToast(isZh ? "导出失败" : "Export failed", "error");
        } finally {
            setExporting(false);
        }
    };

    const handleImportFileChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!token || !file) return;
        setPendingFile(file);
        setShowImportConfirm(true);
    };

    const confirmImport = async () => {
        if (!token || !pendingFile) return;

        try {
            setImporting(true);
            await importSessionsZip(token, pendingFile);
            addToast(isZh ? "会话导入成功客正在重载..." : "Import successful, reloading...", "success");
            setShowImportConfirm(false);
            setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
            addToast(isZh ? "导入失败" : "Import failed", "error");
        } finally {
            setImporting(false);
            setPendingFile(null);
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
                        <h2 className="text-xl font-black tracking-tight uppercase italic">Vault & Logistics</h2>
                        <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mt-0.5">{isZh ? "Data Management Protocol" : "Data Management Protocol"}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Session Backup Card */}
                    <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 flex flex-col gap-10 bg-gradient-to-br from-indigo-500/[0.03] to-transparent shadow-inner">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                                <FileArchive weight="bold" size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold tracking-tight">{isZh ? "快速迁移 / 克隆引擎" : "Neural Migration"}</h3>
                                <p className="text-[10px] text-white/20 uppercase tracking-widest font-black mt-0.5">{isZh ? "Binary Export" : "Binary Export"}</p>
                            </div>
                        </div>
                        
                        <div className="space-y-4 flex-1">
                            <div className="p-5 rounded-2xl bg-black/40 border border-white/5 shadow-inner">
                                <p className="text-[11px] text-white/40 leading-relaxed font-medium">
                                    {isZh ? "导出的 ZIP 压缩包包含所有 Session 存储和代理链配置。在新机器导入后可立即恢复所有账号的登录状态。" : "Exported ZIP contains all session storage and proxy chains. Restore login status instantly on new devices."}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button 
                                className="flex-1 h-12 rounded-xl border border-white/5 bg-white/[0.02] text-white/40 text-[11px] font-black uppercase tracking-widest hover:bg-white/[0.05] hover:text-white transition-all flex items-center justify-center gap-3"
                                onClick={handleExport} 
                                disabled={exporting}
                            >
                                {exporting ? <Spinner className="animate-spin" /> : <><CloudArrowUp size={18} weight="bold" className="text-indigo-400" /> {isZh ? "Export Archive" : "Export Archive"}</>}
                            </button>
                            <label className="flex-1">
                                <div className={`h-12 rounded-xl border border-white/5 bg-white/[0.02] text-white/40 text-[11px] font-black uppercase tracking-widest hover:bg-white/[0.05] hover:text-white transition-all flex items-center justify-center gap-3 cursor-pointer ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                                    {importing ? <Spinner className="animate-spin" /> : <><ArrowUDownLeft size={18} weight="bold" className="text-emerald-400" /> {isZh ? "Inject & Sync" : "Inject & Sync"}</>}
                                </div>
                                <input type="file" accept=".zip" className="hidden" onChange={handleImportFileChanged} disabled={importing} />
                            </label>
                        </div>
                    </div>

                    {/* Engine Settings Card */}
                    <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 flex flex-col gap-10 shadow-inner">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 shadow-inner">
                                <Clock weight="bold" size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold tracking-tight">{isZh ? "系统底层参数" : "Core Runtime Params"}</h3>
                                <p className="text-[10px] text-white/20 uppercase tracking-widest font-black mt-0.5">{isZh ? "System Engine" : "System Engine"}</p>
                            </div>
                        </div>

                        <div className="space-y-8 flex-1">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-[10px] font-black text-white/20 uppercase tracking-widest">{isZh ? "日志保留周期" : "Log Cycle"}</label>
                                    <span className="text-[10px] font-black text-indigo-400 uppercase">{settings.log_retention_days || 7} Days</span>
                                </div>
                                <input 
                                    type="number" 
                                    className="!h-12 bg-black/40 border-white/5 focus:border-indigo-500/30 transition-all rounded-xl px-5 font-mono"
                                    placeholder="Def: 7 Days"
                                    value={settings.log_retention_days || ""}
                                    onChange={(e) => setSettings({ ...settings, log_retention_days: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">{isZh ? "全局签到频率 (SEC)" : "Global Burst Delay (SEC)"}</label>
                                <input 
                                    type="number" 
                                    className="!h-12 bg-black/40 border-white/5 focus:border-indigo-500/30 transition-all rounded-xl px-5 font-mono"
                                    placeholder="Leave empty for auto"
                                    value={settings.sign_interval || ""}
                                    onChange={(e) => setSettings({ ...settings, sign_interval: parseInt(e.target.value) || null })}
                                />
                            </div>
                        </div>

                        <div className="">
                            <button 
                                className="w-full linear-btn-primary h-12 font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3"
                                onClick={handleSaveGlobal} 
                                disabled={loading}
                            >
                                {loading ? <Spinner className="animate-spin" /> : <><FloppyDisk size={18} weight="bold" /> {t("save")}</>}
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {showImportConfirm && (
                <div className="modal-overlay active" onClick={() => setShowImportConfirm(false)}>
                    <div className="glass-panel modal-content !max-w-md !p-0 overflow-hidden animate-zoom-in border-white/5 bg-[#050505]" onClick={e => e.stopPropagation()}>
                        <header className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-inner">
                                    <CloudArrowUp weight="bold" size={20} />
                                </div>
                                <h3 className="text-sm font-bold tracking-tight">
                                    {isZh ? "确认导入数据" : "Neural sync sequence"}
                                </h3>
                            </div>
                            <button onClick={() => setShowImportConfirm(false)} className="icon-btn !w-9 !h-9 bg-white/[0.03] hover:bg-white/[0.08]">
                                <X weight="bold" size={18} />
                            </button>
                        </header>
                        <div className="p-8 space-y-4 text-center">
                            <p className="text-[13px] text-white/80 leading-relaxed font-medium">
                                {isZh ? "导入将覆盖当前所有代理、账户及会话数据。确定要继续进行神经同步吗？" : "Importing will overwrite all current proxies, accounts, and session data. Are you sure you want to proceed with neural sync?"}
                            </p>
                            <div className="flex items-center justify-center gap-2 text-[9px] text-emerald-400/50 uppercase tracking-[0.2em] font-black italic">
                                <Info size={12} weight="bold" />
                                Database Overwrite Authorized
                            </div>
                        </div>
                        <footer className="p-6 border-t border-white/5 flex gap-3 bg-white/[0.01]">
                            <button
                                className="linear-btn-secondary flex-1 h-11 text-[11px] font-black uppercase tracking-widest"
                                onClick={() => setShowImportConfirm(false)}
                                disabled={importing}
                            >
                                {t("cancel")}
                            </button>
                            <button
                                className="flex-1 h-11 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-xl font-black uppercase tracking-widest text-[11px] shadow-[0_4px_20px_rgba(16,185,129,0.2)] transition-all flex items-center justify-center gap-2"
                                onClick={confirmImport}
                                disabled={importing}
                            >
                                {importing ? <Spinner className="animate-spin text-white" /> : <ArrowUDownLeft weight="bold" size={16} />}
                                {isZh ? "立即同步" : "Synchronize"}
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}
