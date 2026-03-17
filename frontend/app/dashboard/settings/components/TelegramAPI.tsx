"use client";

import { CheckCircle, Warning, Info, Spinner, Trash, FloppyDisk, TelegramLogo, ArrowClockwise, X } from "@phosphor-icons/react";
import { useLanguage } from "../../../../context/LanguageContext";
import { useToast } from "../../../../components/ui/toast";
import { 
    TelegramConfig, 
    saveTelegramConfig, 
    resetTelegramConfig 
} from "../../../../lib/api";
import { useState } from "react";

interface TelegramAPIProps {
    token: string;
    telegramConfig: TelegramConfig | null;
    loadTelegramConfig: (token: string) => Promise<void>;
}

export default function TelegramAPI({ token, telegramConfig, loadTelegramConfig }: TelegramAPIProps) {
    const { t, language } = useLanguage();
    const isZh = language === "zh";
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    const [form, setForm] = useState({
        api_id: telegramConfig?.api_id?.toString() || "",
        api_hash: telegramConfig?.api_hash || "",
    });

    const formatErrorMessage = (key: string, err?: any) => {
        const base = t(key);
        const code = err?.code;
        return code ? `${base} (${code})` : base;
    };

    const handleSave = async () => {
        if (!token) return;
        if (!form.api_id || !form.api_hash) {
            addToast(t("form_incomplete"), "error");
            return;
        }
        try {
            setLoading(true);
            await saveTelegramConfig(token, {
                api_id: form.api_id,
                api_hash: form.api_hash,
            });
            addToast(t("telegram_save_success"), "success");
            loadTelegramConfig(token);
        } catch (err: any) {
            addToast(formatErrorMessage("save_failed", err), "error");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        if (!token) return;
        setShowResetConfirm(true);
    };

    const confirmReset = async () => {
        if (!token) return;
        try {
            setLoading(true);
            await resetTelegramConfig(token);
            addToast(t("config_reset"), "success");
            loadTelegramConfig(token);
            setForm({ api_id: "", api_hash: "" });
            setShowResetConfirm(false);
        } catch (err: any) {
            addToast(formatErrorMessage("operation_failed", err), "error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-16 animate-float-up">
            <section className="space-y-8">
                <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                    <div className="w-12 h-12 rounded-2xl bg-[#0088cc]/10 border border-[#0088cc]/20 flex items-center justify-center text-[#0088cc] shadow-inner">
                        <TelegramLogo weight="bold" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight uppercase italic">Telegram Engine</h2>
                        <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mt-0.5">{isZh ? "API Protocol Configuration" : "API Protocol Configuration"}</p>
                    </div>
                </div>

                <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 space-y-10 shadow-inner">
                    {/* Warning Notice */}
                    <div className="p-6 rounded-2xl bg-amber-500/[0.03] border border-amber-500/10 flex gap-5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                            <Warning size={20} weight="bold" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest">{isZh ? "Security Advisory" : "Security Advisory"}</p>
                            <p className="text-[12px] text-white/40 leading-relaxed font-medium">
                                {isZh ? "如果您不清楚这些是什么，请保持默认。修改错误的 API ID/Hash 会导致账号登录失败。" : "Keep default if unsure. Incorrect credentials will cause login failures."}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">Terminal ID (API ID)</label>
                            <input
                                type="text"
                                className="!h-12 bg-black/40 border-white/5 focus:border-[#0088cc]/30 transition-all rounded-xl px-5 font-mono"
                                placeholder="e.g. 12345678"
                                value={form.api_id}
                                onChange={(e) => setForm({ ...form, api_id: e.target.value })}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">Authorization Hash (API Hash)</label>
                            <input
                                type="text"
                                className="!h-12 bg-black/40 border-white/5 focus:border-[#0088cc]/30 transition-all rounded-xl px-5 font-mono"
                                placeholder="e.g. abc123def456..."
                                value={form.api_hash}
                                onChange={(e) => setForm({ ...form, api_hash: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-8 border-t border-white/5">
                        <button 
                            className="h-12 px-6 rounded-xl border border-rose-500/20 text-rose-400 text-[11px] font-black uppercase tracking-widest hover:bg-rose-500/10 transition-all flex items-center gap-3"
                            onClick={handleReset}
                            disabled={loading}
                        >
                            <Trash size={16} weight="bold" />
                            {isZh ? "Reset Protocol" : "Reset Protocol"}
                        </button>
                        <button 
                            className="linear-btn-primary px-10 h-12 font-black uppercase tracking-widest text-[11px] flex items-center gap-3"
                            onClick={handleSave}
                            disabled={loading}
                        >
                            {loading ? <Spinner className="animate-spin" /> : <><FloppyDisk size={18} weight="bold" /> {t("save")}</>}
                        </button>
                    </div>
                </div>
            </section>

            {showResetConfirm && (
                <div className="modal-overlay active" onClick={() => setShowResetConfirm(false)}>
                    <div className="glass-panel modal-content !max-w-md !p-0 overflow-hidden animate-zoom-in border-white/5 bg-[#050505]" onClick={e => e.stopPropagation()}>
                        <header className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
                                    <ArrowClockwise weight="bold" size={20} />
                                </div>
                                <h3 className="text-sm font-bold tracking-tight">
                                    {isZh ? "确认重置协议" : "Reset Protocol"}
                                </h3>
                            </div>
                            <button onClick={() => setShowResetConfirm(false)} className="icon-btn !w-9 !h-9 bg-white/[0.03] hover:bg-white/[0.08]">
                                <X weight="bold" size={18} />
                            </button>
                        </header>
                        <div className="p-8 space-y-4 text-center">
                            <p className="text-[13px] text-white/80 leading-relaxed font-medium">
                                {isZh ? "确定要将 Telegram 配置重置为默认值吗？现有配置将被立即清除。" : "Are you sure you want to reset the Telegram configuration to default values? Current settings will be purged immediately."}
                            </p>
                            <div className="flex items-center justify-center gap-2 text-[9px] text-amber-500/50 uppercase tracking-[0.2em] font-black italic">
                                <Warning size={12} weight="bold" />
                                Infrastructure Override Initiated
                            </div>
                        </div>
                        <footer className="p-6 border-t border-white/5 flex gap-3 bg-white/[0.01]">
                            <button
                                className="linear-btn-secondary flex-1 h-11 text-[11px] font-black uppercase tracking-widest"
                                onClick={() => setShowResetConfirm(false)}
                                disabled={loading}
                            >
                                {t("cancel")}
                            </button>
                            <button
                                className="flex-1 h-11 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl font-black uppercase tracking-widest text-[11px] shadow-[0_4px_20px_rgba(245,158,11,0.2)] transition-all flex items-center justify-center gap-2"
                                onClick={confirmReset}
                                disabled={loading}
                            >
                                {loading ? <Spinner className="animate-spin text-white" /> : <ArrowClockwise weight="bold" size={16} />}
                                {isZh ? "立即重置" : "Proceed Reset"}
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}
