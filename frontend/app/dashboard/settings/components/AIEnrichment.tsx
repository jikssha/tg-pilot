"use client";

import { useState } from "react";
import { 
    Cpu, 
    Spinner, 
    Trash, 
    FloppyDisk, 
    ArrowSquareOut,
    CheckCircle,
    Warning,
    Robot,
    X
} from "@phosphor-icons/react";
import { useLanguage } from "../../../../context/LanguageContext";
import { useToast } from "../../../../components/ui/toast";
import { 
    AIConfig, 
    saveAIConfig, 
    deleteAIConfig, 
    testAIConnection 
} from "../../../../lib/api";

interface AIEnrichmentProps {
    token: string;
    aiConfig: AIConfig | null;
    loadAIConfig: (token: string) => Promise<void>;
}

export default function AIEnrichment({ token, aiConfig, loadAIConfig }: AIEnrichmentProps) {
    const { t, language } = useLanguage();
    const isZh = language === "zh";
    const { addToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<string | null>(null);
    const [testStatus, setTestStatus] = useState<"success" | "error" | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [form, setForm] = useState({
        api_key: "",
        base_url: aiConfig?.base_url || "",
        model: aiConfig?.model || "gpt-4o",
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
            const payload: any = {
                base_url: form.base_url.trim() || undefined,
                model: form.model.trim() || undefined,
            };
            if (form.api_key.trim()) {
                payload.api_key = form.api_key.trim();
            }
            await saveAIConfig(token, payload);
            addToast(t("ai_save_success"), "success");
            loadAIConfig(token);
            setForm({ ...form, api_key: "" }); // 清空密钥输入框
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
            setTestResult(null);
            setTestStatus(null);
            const res = await testAIConnection(token);
            if (res.success) {
                setTestStatus("success");
                setTestResult(t("connect_success"));
            } else {
                setTestStatus("error");
                setTestResult(t("connect_failed"));
            }
        } catch (err: any) {
            setTestStatus("error");
            setTestResult(formatErrorMessage("test_failed", err));
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
            await deleteAIConfig(token);
            addToast(t("ai_delete_success"), "success");
            loadAIConfig(token);
            setForm({ api_key: "", base_url: "", model: "gpt-4o" });
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
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner">
                        <Robot weight="bold" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight uppercase">AI 智能辅助层</h2>
                        <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mt-0.5">{isZh ? "LLM 集成与能力增强" : "LLM Integration Protocol"}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Main Settings */}
                    <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 space-y-8 shadow-inner">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 shadow-inner">
                                <Cpu weight="bold" size={20} />
                            </div>
                            <h3 className="text-sm font-bold tracking-tight">API 基础设施</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">API 密钥 (SECRET KEY)</label>
                                    {aiConfig && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                            <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                                            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest">已受保护 (VAULTED)</span>
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="password"
                                    className="!h-12 bg-black/40 border-white/5 focus:border-purple-500/30 transition-all rounded-xl px-5 font-mono"
                                    placeholder={aiConfig ? "输入新密钥以更换现有密钥..." : "请输入 API Key (sk-...)"}
                                    value={form.api_key}
                                    onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest ml-1">接口网关地址 (BASE URL)</label>
                                <input
                                    type="text"
                                    className="!h-12 bg-black/40 border-white/5 focus:border-purple-500/30 transition-all rounded-xl px-5 font-mono"
                                    placeholder="https://api.openai.com/v1"
                                    value={form.base_url}
                                    onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest ml-1">核心 AI 模型 (MODEL)</label>
                                <input
                                    type="text"
                                    className="!h-12 bg-black/40 border-white/5 focus:border-purple-500/30 transition-all rounded-xl px-5 font-mono"
                                    placeholder="例如 gpt-4o 或 gpt-3.5-turbo"
                                    value={form.model}
                                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Features & Help */}
                    <div className="flex flex-col">
                        <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 flex-1 bg-gradient-to-br from-white/[0.02] to-transparent shadow-inner">
                            <h3 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] pl-1 mb-8">AI 辅助核心能力</h3>
                            <ul className="space-y-6">
                                <li className="flex gap-4 group">
                                    <div className="w-8 h-8 rounded-xl bg-black/20 border border-white/5 flex items-center justify-center text-[11px] font-bold text-white/20 group-hover:text-purple-400 group-hover:border-purple-500/20 transition-all">01</div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-white/80">语义分发 (Semantic Dispatching)</p>
                                        <p className="text-[11px] text-white/30 leading-relaxed font-medium">通过自然语言解析，将任务自动分配至最匹配的账号执行。</p>
                                    </div>
                                </li>
                                <li className="flex gap-4 group">
                                    <div className="w-8 h-8 rounded-xl bg-black/20 border border-white/5 flex items-center justify-center text-[11px] font-bold text-white/20 group-hover:text-purple-400 group-hover:border-purple-500/20 transition-all">02</div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-white/80">日志智能总结 (Dynamic Abstracting)</p>
                                        <p className="text-[11px] text-white/30 leading-relaxed font-medium">将复杂的循环执行日志转化为简洁、可读性高的人类语言总结。</p>
                                    </div>
                                </li>
                                <li className="flex gap-4 group">
                                    <div className="w-8 h-8 rounded-xl bg-black/20 border border-white/5 flex items-center justify-center text-[11px] font-bold text-white/20 group-hover:text-purple-400 group-hover:border-purple-500/20 transition-all">03</div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-white/80">异常自动诊断 (Auto Diagnostics)</p>
                                        <p className="text-[11px] text-white/30 leading-relaxed font-medium">自动识别任务报错模式，并提供针对性的解决方案建议。</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Status Bar */}
                {(testResult || testing) && (
                    <div className={`p-6 rounded-2xl border animate-zoom-in flex items-center justify-between shadow-inner ${testStatus === 'success' ? 'bg-emerald-500/[0.03] border-emerald-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : 'bg-rose-500/[0.03] border-rose-500/10 text-rose-400'}`}>
                        <div className="flex items-center gap-4">
                            {testing ? (
                                <Spinner size={20} className="animate-spin opacity-50" />
                            ) : testStatus === 'success' ? (
                                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center"><CheckCircle size={18} weight="bold" /></div>
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center"><Warning size={18} weight="bold" /></div>
                            )}
                            <span className="text-[11px] font-bold uppercase tracking-widest">
                                {testing ? '正在测试 AI 接口连通性...' : testResult}
                            </span>
                        </div>
                    </div>
                )}

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-10 border-t border-white/5">
                    <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                        <button 
                            className="h-12 px-8 rounded-xl border border-white/5 bg-white/[0.02] text-white/40 text-[11px] font-bold uppercase tracking-widest hover:bg-white/[0.05] hover:text-white transition-all flex items-center justify-center gap-3" 
                            onClick={handleTest} 
                            disabled={testing}
                        >
                            <ArrowSquareOut size={18} weight="bold" className="text-purple-400" /> {isZh ? "测试 AI 连接" : "Test Link"}
                        </button>
                        <button 
                            className="h-12 px-8 rounded-xl border border-rose-500/10 bg-rose-500/[0.02] text-rose-400/40 text-[11px] font-bold uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-400 transition-all flex items-center justify-center gap-3" 
                            onClick={handleDelete} 
                            disabled={loading}
                        >
                            <Trash size={18} weight="bold" /> {isZh ? "清除当前配置" : "Purge Config"}
                        </button>
                    </div>
                    <button 
                        className="w-full md:w-auto linear-btn-primary px-12 h-12 font-bold uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.1)]" 
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
                                    {isZh ? "确认删除 AI 配置" : "Purge Intelligence"}
                                </h3>
                            </div>
                            <button onClick={() => setShowDeleteConfirm(false)} className="icon-btn !w-9 !h-9 bg-white/[0.03] hover:bg-white/[0.08]">
                                <X weight="bold" size={18} />
                            </button>
                        </header>
                        <div className="p-8 space-y-4 text-center">
                            <p className="text-[13px] text-white/80 leading-relaxed font-medium">
                                {isZh ? "确定要删除 AI 配置吗？删除后语义调度与日志总结功能将暂时失效。" : "Are you sure you want to delete the AI configuration?"}
                            </p>
                            <div className="flex items-center justify-center gap-2 text-[9px] text-purple-400/50 uppercase tracking-[0.2em] font-bold italic">
                                <Warning size={12} weight="bold" />
                                {isZh ? "配置数据将被彻底擦除" : "Memory Bank Purge Initiated"}
                            </div>
                        </div>
                        <footer className="p-6 border-t border-white/5 flex gap-3 bg-white/[0.01]">
                            <button
                                className="linear-btn-secondary flex-1 h-11 text-[11px] font-bold uppercase tracking-widest"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={loading}
                            >
                                {t("cancel")}
                            </button>
                            <button
                                className="flex-1 h-11 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white rounded-xl font-bold uppercase tracking-widest text-[11px] shadow-[0_4px_20px_rgba(244,63,94,0.3)] transition-all flex items-center justify-center gap-2"
                                onClick={confirmDelete}
                                disabled={loading}
                            >
                                {loading ? <Spinner className="animate-spin text-white" /> : <Trash weight="bold" size={16} />}
                                {isZh ? "立即删除" : "Terminate"}
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}
