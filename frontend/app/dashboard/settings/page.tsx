"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "../../../lib/auth";
import {
    CaretLeft,
    UserCircle,
    TelegramLogo,
    Bell,
    Cpu,
    Database,
    SignOut,
    GithubLogo,
} from "@phosphor-icons/react";
import { ToastContainer, useToast } from "../../../components/ui/toast";
import { ThemeLanguageToggle } from "../../../components/ThemeLanguageToggle";
import { useLanguage } from "../../../context/LanguageContext";

// Modular Components
import AccountSecurity from "./components/AccountSecurity";
import TelegramAPI from "./components/TelegramAPI";
import NotificationService from "./components/NotificationService";
import AIEnrichment from "./components/AIEnrichment";
import BackupMigration from "./components/BackupMigration";
import AuditTrail from "./components/AuditTrail";
import OperationsOverview from "./components/OperationsOverview";
import { useSettingsData } from "@/features/settings/hooks/use-settings-data";

export default function SettingsPage() {
    const router = useRouter();
    const { t, language } = useLanguage();
    const isZh = language === "zh";
    const [token, setLocalToken] = useState<string | null>(null);
    const [checking, setChecking] = useState(true);
    const { toasts, removeToast } = useToast();

    // Tab State
    const [currentTab, setCurrentTab] = useState<"account" | "telegram" | "notification" | "ai" | "backup" | "ops" | "audit">("account");

    // Unified Data State
    const [localTotpEnabled, setLocalTotpEnabled] = useState(false);
    useEffect(() => {
        const tokenStr = getToken();
        if (!tokenStr) {
            window.location.replace("/");
            return;
        }
        setLocalToken(tokenStr);
        setChecking(false);
    }, []);
    const settingsQuery = useSettingsData(token);
    const { totpEnabled, aiConfig, globalSettings, telegramConfig, botNotifyConfig } = settingsQuery;

    useEffect(() => {
        setLocalTotpEnabled(totpEnabled);
    }, [totpEnabled]);

    if (!token || checking) return null;

    const navItems = [
        { id: "account", icon: UserCircle, label: isZh ? "账户安全与验证" : "Account & Security" },
        { id: "telegram", icon: TelegramLogo, label: isZh ? "Telegram API" : "Telegram API" },
        { id: "notification", icon: Bell, label: isZh ? "通知服务中心" : "Notifications" },
        { id: "ops", icon: Cpu, label: isZh ? "系统运维概览" : "Operations" },
        { id: "ai", icon: Cpu, label: isZh ? "AI 辅助增强" : "AI Enrichment" },
        { id: "backup", icon: Database, label: isZh ? "备份与系统设置" : "Backup & Settings" },
        { id: "audit", icon: UserCircle, label: isZh ? "审计事件追踪" : "Audit Trail" },
    ] as const;

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-body)] text-white">
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            
            {/* Premium Header */}
            <header className="h-[60px] px-8 flex items-center justify-between border-b border-white/[0.05] bg-black/40 backdrop-blur-xl z-50 shrink-0">
                <div className="flex items-center gap-6">
                    <Link href="/dashboard" className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center hover:bg-white/[0.08] transition-all" title={t("sidebar_home")}>
                        <CaretLeft weight="bold" size={18} />
                    </Link>
                    <div className="h-5 w-px bg-white/10"></div>
                    <div>
                        <h1 className="text-sm font-bold tracking-tight">
                            {isZh ? "系统控制面板" : "System Configuration"}
                        </h1>
                        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#8a3ffc] mt-0.5 opacity-80 shadow-[0_0_20px_rgba(138,63,252,0.3)]">
                            Global Control Center
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Node Healthy</span>
                    </div>
                    <div className="h-5 w-px bg-white/10 mx-1"></div>
                    <ThemeLanguageToggle />
                    <a href="https://github.com/jikssha/tg-pilot" target="_blank" rel="noreferrer" className="icon-btn" title="GitHub">
                        <GithubLogo weight="bold" size={18} />
                    </a>
                    <button 
                        className="icon-btn !text-rose-400 hover:bg-rose-500/10" 
                        title={t("logout")}
                        onClick={() => {
                            const { logout } = require("../../../lib/auth");
                            logout();
                            router.push("/");
                        }}
                    >
                        <SignOut weight="bold" size={18} />
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Navigation */}
                <aside className="w-[320px] border-r border-white/5 p-8 hidden md:flex flex-col gap-10 bg-black/20 overflow-y-auto custom-scrollbar">
                    <div>
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-6 pl-4">General Settings</p>
                        <nav className="space-y-1">
                            {navItems.slice(0, 3).map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setCurrentTab(item.id)}
                                    className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all ${
                                        currentTab === item.id 
                                        ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" 
                                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.02]"
                                    }`}
                                >
                                    <item.icon size={20} weight={currentTab === item.id ? "fill" : "bold"} className={currentTab === item.id ? "text-[#8a3ffc]" : ""} />
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div>
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-6 pl-4">Advanced Protocol</p>
                        <nav className="space-y-1">
                            {navItems.slice(3).map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setCurrentTab(item.id)}
                                    className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all ${
                                        currentTab === item.id 
                                        ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" 
                                        : "text-white/40 hover:text-white/70 hover:bg-white/[0.02]"
                                    }`}
                                >
                                    <item.icon size={20} weight={currentTab === item.id ? "fill" : "bold"} className={currentTab === item.id ? "text-[#8a3ffc]" : ""} />
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="mt-auto">
                        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                            <p className="text-[11px] text-white/20 font-medium leading-relaxed italic">
                                {isZh ? "“ 极简是最高级的复杂 ”" : "“ Simplicity is the ultimate sophistication ”"}
                            </p>
                        </div>
                    </div>
                </aside>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto custom-scrollbar bg-black/10 p-6 md:p-12 lg:p-16">
                    <div className="max-w-4xl mx-auto min-h-full flex flex-col">
                        <div className="flex-1">
                            {currentTab === "account" && (
                                <AccountSecurity 
                                    token={token} 
                                    totpEnabled={localTotpEnabled} 
                                    setTotpEnabled={setLocalTotpEnabled} 
                                    setToken={setLocalToken} 
                                />
                            )}
                            {currentTab === "telegram" && (
                                <TelegramAPI 
                                    token={token} 
                                    telegramConfig={telegramConfig} 
                                    loadTelegramConfig={async () => { await settingsQuery.refetch(); }} 
                                />
                            )}
                            {currentTab === "notification" && (
                                <NotificationService 
                                    token={token} 
                                    botNotifyConfig={botNotifyConfig} 
                                    globalSettings={globalSettings}
                                    loadBotNotifyConfig={async () => { await settingsQuery.refetch(); }} 
                                />
                            )}
                            {currentTab === "ops" && (
                                <OperationsOverview token={token} />
                            )}
                            {currentTab === "ai" && (
                                <AIEnrichment 
                                    token={token} 
                                    aiConfig={aiConfig} 
                                    loadAIConfig={async () => { await settingsQuery.refetch(); }} 
                                />
                            )}
                            {currentTab === "backup" && (
                                <BackupMigration 
                                    token={token} 
                                    globalSettings={globalSettings} 
                                    loadGlobalSettings={async () => { await settingsQuery.refetch(); }} 
                                />
                            )}
                            {currentTab === "audit" && (
                                <AuditTrail token={token} />
                            )}
                        </div>

                        {/* Footer Info */}
                        <footer className="mt-20 pt-10 border-t border-white/5 flex flex-col items-center gap-4 text-white/10 group hover:text-white/20 transition-colors">
                            <p className="text-[9px] uppercase tracking-[0.6em] font-bold">TG-Pilot Minimalist Protocol</p>
                            <div className="flex gap-6 opacity-50 group-hover:opacity-100 transition-opacity">
                                <i className="ph ph-shield-check text-lg"></i>
                                <i className="ph ph-lightning text-lg"></i>
                                <i className="ph ph-cube text-lg"></i>
                            </div>
                        </footer>
                    </div>
                </main>
            </div>
        </div>
    );
}
