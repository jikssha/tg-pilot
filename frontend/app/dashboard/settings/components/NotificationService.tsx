"use client";

import { useState } from "react";
import { 
    Bell, 
    Spinner, 
    Trash, 
    FloppyDisk, 
    PaperPlaneTilt,
    CheckCircle,
    Warning
} from "@phosphor-icons/react";
import { useLanguage } from "../../../../context/LanguageContext";
import { useToast } from "../../../../components/ui/toast";
import { 
    BotNotifyConfig, 
    saveBotNotifyConfig, 
    deleteBotNotifyConfig, 
    testBotNotify, 
    GlobalSettings
} from "../../../../lib/api";

interface NotificationServiceProps {
    token: string;
    botNotifyConfig: BotNotifyConfig | null;
    globalSettings: GlobalSettings;
    loadBotNotifyConfig: (token: string) => Promise<void>;
}

export default function NotificationService({ token, botNotifyConfig, globalSettings, loadBotNotifyConfig }: NotificationServiceProps) {
    const { t, language } = useLanguage();
    const isZh = language === "zh";
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [form, setForm] = useState({
        bot_token: "", // 不回填
        chat_id: botNotifyConfig?.chat_id || "",
        enabled: botNotifyConfig?.enabled ?? true,
        notify_on_success: botNotifyConfig?.notify_on_success ?? true,
        notify_on_failure: botNotifyConfig?.notify_on_failure ?? true,
        daily_summary: botNotifyConfig?.daily_summary ?? true,
        daily_summary_hour: botNotifyConfig?.daily_summary_hour ?? 22,
        daily_summary_minute: botNotifyConfig?.daily_summary_minute ?? 0,
    });

    const formatErrorMessage = (key: string, err?: any) => {
        const base = t(key);
        const code = err?.code;
        return code ? `${base} (${code})` : base;
    };

    const handleSave = async () => {
        if (!token) return;
        try {
            setLoading(true);
            await saveBotNotifyConfig(token, {
                bot_token: form.bot_token.trim() || undefined,
                chat_id: form.chat_id.trim() || undefined,
                enabled: form.enabled,
                notify_on_success: form.notify_on_success,
                notify_on_failure: form.notify_on_failure,
                daily_summary: form.daily_summary,
                daily_summary_hour: form.daily_summary_hour,
                daily_summary_minute: form.daily_summary_minute,
            });
            addToast(isZh ? "通知配置已保存" : "Notification saved", "success");
            loadBotNotifyConfig(token);
        } catch (err: any) {
            addToast(formatErrorMessage("save_failed", err), "error");
        } finally {
            setLoading(false);
        }
    };

    const handleTest = async () => {
        if (!token) return;
        try {
            setTesting(true);
            const res = await testBotNotify(token);
            if (res.success) {
                addToast(isZh ? "测试消息已发送" : "Test message sent", "success");
            } else {
                addToast(res.message || (isZh ? "发送失败" : "Send failed"), "error");
            }
        } catch (err: any) {
            addToast(formatErrorMessage("test_failed", err), "error");
        } finally {
            setTesting(false);
        }
    };

    const handleDelete = () => {
        if (!token) return;
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!token) return;
        try {
            setLoading(true);
            await deleteBotNotifyConfig(token);
            addToast(isZh ? "配置已移除" : "Config removed", "success");
            loadBotNotifyConfig(token);
            setForm({ ...form, bot_token: "", chat_id: "" });
            setShowDeleteConfirm(false);
        } catch (err: any) {
            addToast(formatErrorMessage("delete_failed", err), "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-16 animate-float-up">
            <section className="space-y-8">
                <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                        <Bell weight="bold" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight uppercase italic">Broadcast Center</h2>
                        <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mt-0.5">{isZh ? "Notification Hub Protocol" : "Notification Hub Protocol"}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Bot Credentials */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 space-y-8 shadow-inner">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 shadow-inner">
                                    <PaperPlaneTilt weight="bold" size={20} />
                                </div>
                                <h3 className="text-sm font-bold tracking-tight">Access Credentials</h3>
                            </div>
                            <div className="grid grid-cols-1 gap-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">Secure Bot Token</label>
                                    <input
                                        type="password"
                                        className="!h-12 bg-black/40 border-white/5 focus:border-indigo-500/30 transition-all rounded-xl px-5 font-mono"
                                        placeholder="e.g. 123456:ABC-DEF..."
                                        value={form.bot_token}
                                        onChange={(e) => setForm({ ...form, bot_token: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">Target Chat Identity (ID)</label>
                                    <input
                                        type="text"
                                        className="!h-12 bg-black/40 border-white/5 focus:border-indigo-500/30 transition-all rounded-xl px-5 font-mono"
                                        placeholder="e.g. 123456789"
                                        value={form.chat_id}
                                        onChange={(e) => setForm({ ...form, chat_id: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Event Toggles */}
                        <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 space-y-8 shadow-inner">
                            <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] pl-1">Execution Triggers</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <label className="flex flex-col gap-3 p-5 rounded-2xl bg-black/20 border border-white/5 hover:border-white/10 transition-all cursor-pointer group">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40 group-hover:text-white/60">Service</span>
                                        <input 
                                            type="checkbox" 
                                            className="!w-5 !h-5 accent-indigo-500" 
                                            checked={form.enabled}
                                            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                                        />
                                    </div>
                                    <span className="text-sm font-bold">{isZh ? "总服务开关" : "Main Switch"}</span>
                                </label>
                                <label className="flex flex-col gap-3 p-5 rounded-2xl bg-black/20 border border-white/5 hover:border-white/10 transition-all cursor-pointer group text-emerald-400">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-60 text-emerald-400">Log</span>
                                        <input 
                                            type="checkbox" 
                                            className="!w-5 !h-5 accent-emerald-500" 
                                            checked={form.notify_on_success}
                                            onChange={(e) => setForm({ ...form, notify_on_success: e.target.checked })}
                                        />
                                    </div>
                                    <span className="text-sm font-bold">{isZh ? "成功时提醒" : "On Success"}</span>
                                </label>
                                <label className="flex flex-col gap-3 p-5 rounded-2xl bg-black/20 border border-white/5 hover:border-white/10 transition-all cursor-pointer group text-rose-400">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-60 text-rose-400">Alert</span>
                                        <input 
                                            type="checkbox" 
                                            className="!w-5 !h-5 accent-rose-500" 
                                            checked={form.notify_on_failure}
                                            onChange={(e) => setForm({ ...form, notify_on_failure: e.target.checked })}
                                        />
                                    </div>
                                    <span className="text-sm font-bold">{isZh ? "失败时提醒" : "On Failure"}</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Daily Summary */}
                    <div className="space-y-8">
                        <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 h-full flex flex-col shadow-inner">
                            <div className="flex items-center gap-4 mb-10">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
                                    <FloppyDisk weight="bold" size={20} />
                                </div>
                                <h3 className="text-sm font-bold tracking-tight">{isZh ? "每日结算报告" : "Daily Abstract"}</h3>
                            </div>
                            <div className="flex-1 space-y-10">
                                <label className="flex items-center justify-between p-5 rounded-2xl bg-black/20 border border-white/5 hover:border-white/10 transition-all cursor-pointer group">
                                    <span className="text-xs font-bold text-white/40 group-hover:text-white/60">{isZh ? "开启报告推送" : "Enable Protocol"}</span>
                                    <input 
                                        type="checkbox" 
                                        className="!w-5 !h-5 accent-amber-500" 
                                        checked={form.daily_summary}
                                        onChange={(e) => setForm({ ...form, daily_summary: e.target.checked })}
                                    />
                                </label>
                                <div className="space-y-6">
                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] ml-1">{isZh ? "Scheduled Window" : "Scheduled Window"}</p>
                                    <div className="flex items-center gap-3">
                                        <select 
                                            className="flex-1 !h-12 !bg-black/40 !border-white/5 !rounded-xl !px-4 font-mono text-center text-lg font-bold hover:!bg-black/60 transition-all"
                                            value={form.daily_summary_hour}
                                            onChange={(e) => setForm({ ...form, daily_summary_hour: parseInt(e.target.value) })}
                                        >
                                            {Array.from({ length: 24 }).map((_, i) => (
                                                <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                                            ))}
                                        </select>
                                        <span className="text-white/10 font-black text-xl">:</span>
                                        <select 
                                            className="flex-1 !h-12 !bg-black/40 !border-white/5 !rounded-xl !px-4 font-mono text-center text-lg font-bold hover:!bg-black/60 transition-all"
                                            value={form.daily_summary_minute}
                                            onChange={(e) => setForm({ ...form, daily_summary_minute: parseInt(e.target.value) })}
                                        >
                                            {Array.from({ length: 60 }).map((_, i) => (
                                                <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="p-4 rounded-xl bg-white/[0.01] border border-white/[0.02] flex flex-col items-center gap-2">
                                        <p className="text-[10px] text-white/20 leading-relaxed font-medium text-center">
                                            {isZh ? "每日将在该时间点发送全账号签到统计" : "Global stats sent daily at this time"}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1 px-3 py-1 rounded-full bg-indigo-500/5 border border-indigo-500/10">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                            <span className="text-[10px] font-bold text-indigo-400 capitalize whitespace-nowrap">
                                                {isZh ? "当前服务器时间" : "Server Time"}: <span className="font-mono text-ms">{globalSettings.server_time || "--:--"}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-10 border-t border-white/5">
                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                        <button 
                            className="h-12 px-8 rounded-xl border border-white/5 bg-white/[0.02] text-white/40 text-[11px] font-black uppercase tracking-widest hover:bg-white/[0.05] hover:text-white transition-all flex items-center justify-center gap-3" 
                            onClick={handleTest} 
                            disabled={testing}
                        >
                            {testing ? <Spinner className="animate-spin" /> : <><PaperPlaneTilt size={18} weight="bold" className="text-indigo-400" /> {isZh ? "Execute Test" : "Execute Test"}</>}
                        </button>
                        <button 
                            className="h-12 px-8 rounded-xl border border-rose-500/10 bg-rose-500/[0.02] text-rose-500/40 text-[11px] font-black uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-400 transition-all flex items-center justify-center gap-3" 
                            onClick={handleDelete} 
                            disabled={loading}
                        >
                            <Trash size={18} weight="bold" /> {isZh ? "Purge Configuration" : "Purge Configuration"}
                        </button>
                    </div>
                    <button 
                        className="w-full md:w-auto linear-btn-primary px-12 h-12 font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.1)]" 
                        onClick={handleSave} 
                        disabled={loading}
                    >
                        {loading ? <Spinner className="animate-spin" /> : <><FloppyDisk size={18} weight="bold" /> {t("save")}</>}
                    </button>
                </div>
            </section>

            {showDeleteConfirm && (
                <div className="modal-overlay active" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="glass-panel modal-content !max-w-md !p-0 overflow-hidden animate-zoom-in border-white/5 bg-[#050505]" onClick={e => e.stopPropagation()}>
                        <header className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-inner">
                                    <Trash weight="bold" size={20} />
                                </div>
                                <h3 className="text-sm font-bold tracking-tight">
                                    {isZh ? "确认删除配置" : "Purge Configuration"}
                                </h3>
                            </div>
                            <button onClick={() => setShowDeleteConfirm(false)} className="icon-btn !w-9 !h-9 bg-white/[0.03] hover:bg-white/[0.08]">
                                <X weight="bold" size={18} />
                            </button>
                        </header>
                        <div className="p-8 space-y-4 text-center">
                            <p className="text-[13px] text-white/80 leading-relaxed font-medium">
                                {isZh ? "确定要删除 Bot 通知配置吗？此操作将立即停止所有电报频道的消息同步。" : "Are you sure you want to delete the Bot notification configuration? This will immediately stop all message synchronization to Telegram channels."}
                            </p>
                            <div className="flex items-center justify-center gap-2 text-[9px] text-rose-400/50 uppercase tracking-[0.2em] font-black italic">
                                <Warning size={12} weight="bold" />
                                Destruction Protocol Initiated
                            </div>
                        </div>
                        <footer className="p-6 border-t border-white/5 flex gap-3 bg-white/[0.01]">
                            <button
                                className="linear-btn-secondary flex-1 h-11 text-[11px] font-black uppercase tracking-widest"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={loading}
                            >
                                {t("cancel")}
                            </button>
                            <button
                                className="flex-1 h-11 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white rounded-xl font-black uppercase tracking-widest text-[11px] shadow-[0_4px_20px_rgba(244,63,94,0.3)] transition-all flex items-center justify-center gap-2"
                                onClick={confirmDelete}
                                disabled={loading}
                            >
                                {loading ? <Spinner className="animate-spin text-white" /> : <Trash weight="bold" size={16} />}
                                {isZh ? "立即移除" : "Removal Now"}
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}
