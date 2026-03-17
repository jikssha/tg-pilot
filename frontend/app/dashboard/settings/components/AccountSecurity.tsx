"use client";

import { useState } from "react";
import { User, Lock, ShieldCheck, Spinner, CheckCircle, Warning, Info } from "@phosphor-icons/react";
import { useLanguage } from "../../../../context/LanguageContext";
import { useToast } from "../../../../components/ui/toast";
import { 
    changeUsername, 
    changePassword, 
    setupTOTP, 
    enableTOTP, 
    disableTOTP 
} from "../../../../lib/api";

interface AccountSecurityProps {
    token: string;
    totpEnabled: boolean;
    setTotpEnabled: (enabled: boolean) => void;
    setToken: (token: string) => void;
}

export default function AccountSecurity({ token, totpEnabled, setTotpEnabled, setToken }: AccountSecurityProps) {
    const { t, language } = useLanguage();
    const isZh = language === "zh";
    const { addToast } = useToast();

    // Loadings
    const [userLoading, setUserLoading] = useState(false);
    const [pwdLoading, setPwdLoading] = useState(false);
    const [totpLoading, setTotpLoading] = useState(false);

    // Username form
    const [usernameForm, setUsernameForm] = useState({
        newUsername: "",
        password: "",
    });

    // Password form
    const [passwordForm, setPasswordForm] = useState({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

    // 2FA state
    const [totpSecret, setTotpSecret] = useState("");
    const [totpCode, setTotpCode] = useState("");
    const [showTotpSetup, setShowTotpSetup] = useState(false);

    const formatErrorMessage = (key: string, err?: any) => {
        const base = t(key);
        const code = err?.code;
        return code ? `${base} (${code})` : base;
    };

    const handleChangeUsername = async () => {
        if (!token) return;
        if (!usernameForm.newUsername || !usernameForm.password) {
            addToast(t("form_incomplete"), "error");
            return;
        }
        try {
            setUserLoading(true);
            const res = await changeUsername(token, usernameForm.newUsername, usernameForm.password);
            addToast(t("username_changed"), "success");
            if (res.access_token) {
                localStorage.setItem("tg-pilot-token", res.access_token);
                setToken(res.access_token);
            }
            setUsernameForm({ newUsername: "", password: "" });
        } catch (err: any) {
            addToast(formatErrorMessage("change_failed", err), "error");
        } finally {
            setUserLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!token) return;
        if (!passwordForm.oldPassword || !passwordForm.newPassword) {
            addToast(t("form_incomplete"), "error");
            return;
        }
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            addToast(t("password_mismatch"), "error");
            return;
        }
        try {
            setPwdLoading(true);
            await changePassword(token, passwordForm.oldPassword, passwordForm.newPassword);
            addToast(t("password_changed"), "success");
            setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
        } catch (err: any) {
            addToast(formatErrorMessage("change_failed", err), "error");
        } finally {
            setPwdLoading(false);
        }
    };

    const handleSetupTOTP = async () => {
        if (!token) return;
        try {
            setTotpLoading(true);
            const res = await setupTOTP(token);
            setTotpSecret(res.secret);
            setShowTotpSetup(true);
        } catch (err: any) {
            addToast(formatErrorMessage("setup_failed", err), "error");
        } finally {
            setTotpLoading(false);
        }
    };

    const handleEnableTOTP = async () => {
        if (!token) return;
        if (!totpCode) {
            addToast(t("login_code_required"), "error");
            return;
        }
        try {
            setTotpLoading(true);
            await enableTOTP(token, totpCode);
            addToast(t("two_factor_enabled"), "success");
            setTotpEnabled(true);
            setShowTotpSetup(false);
            setTotpCode("");
        } catch (err: any) {
            addToast(formatErrorMessage("enable_failed", err), "error");
        } finally {
            setTotpLoading(false);
        }
    };

    const handleDisableTOTP = async () => {
        if (!token) return;
        const msg = t("two_factor_disable_prompt");
        const code = prompt(msg);
        if (!code) return;
        try {
            setTotpLoading(true);
            await disableTOTP(token, code);
            addToast(t("two_factor_disabled"), "success");
            setTotpEnabled(false);
        } catch (err: any) {
            addToast(formatErrorMessage("disable_failed", err), "error");
        } finally {
            setTotpLoading(false);
        }
    };

    return (
        <div className="space-y-16 animate-float-up">
            {/* Username Section */}
            <section className="space-y-8">
                <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-inner">
                        <User weight="bold" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight uppercase italic">{t("username")}</h2>
                        <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mt-0.5">{isZh ? "Identifier Management" : "Identifier Management"}</p>
                    </div>
                </div>

                <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 space-y-8 shadow-inner">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">{t("new_username")}</label>
                            <input
                                type="text"
                                className="!h-12 bg-black/40 border-white/5 focus:border-sky-500/30 transition-all rounded-xl px-5"
                                placeholder={t("new_username_placeholder")}
                                value={usernameForm.newUsername}
                                onChange={(e) => setUsernameForm({ ...usernameForm, newUsername: e.target.value })}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">{t("current_password")}</label>
                            <input
                                type="password"
                                className="!h-12 bg-black/40 border-white/5 focus:border-sky-500/30 transition-all rounded-xl px-5"
                                placeholder={t("current_password_placeholder")}
                                value={usernameForm.password}
                                onChange={(e) => setUsernameForm({ ...usernameForm, password: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button 
                            className="linear-btn-primary px-10 h-12 min-w-[160px] font-black uppercase tracking-widest text-[11px]" 
                            disabled={userLoading}
                            onClick={handleChangeUsername}
                        >
                            {userLoading ? <Spinner className="animate-spin" /> : t("username")}
                        </button>
                    </div>
                </div>
            </section>

            {/* Security Section (2FA & Password) */}
            <section className="space-y-8">
                <div className="flex items-center gap-4 pb-4 border-b border-white/5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
                        <ShieldCheck weight="bold" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight uppercase italic">{t("account_security")}</h2>
                        <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mt-0.5">{isZh ? "Advanced Protection" : "Advanced Protection"}</p>
                    </div>
                </div>

                {/* 2FA Card */}
                <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 transition-all hover:bg-white/[0.03]">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center shadow-inner ${totpEnabled ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                                <Lock weight="bold" size={28} />
                            </div>
                            <div className="space-y-1.5 text-center md:text-left">
                                <div className="flex items-center justify-center md:justify-start gap-4">
                                    <h3 className="text-base font-bold tracking-tight">{t("two_factor_auth")} (2FA)</h3>
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${totpEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                                        {totpEnabled ? t("enabled") : t("disabled")}
                                    </span>
                                </div>
                                <p className="text-[11px] text-white/30 leading-relaxed max-w-sm font-medium">
                                    {isZh ? "启用两步验证将显著提升您的账户安全性。启用后，登录时除了密码外，还需要输入动态代码。" : "2FA significantly improves account security by requiring a dynamic code upon login."}
                                </p>
                            </div>
                        </div>
                        <div className="shrink-0 w-full md:w-auto">
                            {totpEnabled ? (
                                <button className="w-full md:w-auto px-8 h-12 rounded-xl border border-rose-500/20 text-rose-400 text-[11px] font-black uppercase tracking-widest hover:bg-rose-500/10 transition-all" onClick={handleDisableTOTP} disabled={totpLoading}>
                                    {totpLoading ? <Spinner className="animate-spin" /> : t("disable_2fa")}
                                </button>
                            ) : (
                                <button className="w-full md:w-auto linear-btn-primary px-8 h-12 !font-black !uppercase !tracking-widest !text-[11px]" onClick={handleSetupTOTP} disabled={totpLoading}>
                                    {totpLoading ? <Spinner className="animate-spin" /> : t("start_setup")}
                                </button>
                            )}
                        </div>
                    </div>

                    {showTotpSetup && (
                        <div className="mt-10 pt-10 border-t border-white/5 animate-zoom-in space-y-10 bg-black/20 -mx-8 -mb-8 px-8 pb-8 rounded-b-3xl">
                            <div className="flex flex-col md:flex-row gap-10 items-center">
                                <div className="p-4 bg-white rounded-3xl shadow-[0_0_40px_rgba(255,255,255,0.1)] shrink-0">
                                    <img 
                                        src={`/api/auth/totp/qrcode?secret=${totpSecret}&name=${encodeURIComponent(usernameForm.newUsername || 'User')}`} 
                                        alt="QR Code" 
                                        className="w-32 h-32"
                                    />
                                </div>
                                <div className="flex-1 space-y-6">
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-black text-[#8a3ffc] uppercase tracking-widest">{isZh ? "Step 01: Scan Identity" : "Step 01: Scan Identity"}</p>
                                        <p className="text-[13px] font-bold">{isZh ? "使用验证器扫描二维码" : "Use Google Authenticator or similar apps"}</p>
                                        <div className="bg-white/5 px-4 py-3 rounded-xl border border-white/5 font-mono text-[11px] text-white/40 select-all break-all cursor-copy">
                                            {totpSecret}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-[#8a3ffc] uppercase tracking-widest font-bold">{isZh ? "Step 02: Verification" : "Step 02: Verification"}</p>
                                        <div className="flex gap-4">
                                            <input 
                                                type="text" 
                                                placeholder={t("digit_code_placeholder")} 
                                                className="!h-12 bg-black/40 border-white/5 focus:border-sky-500/30 transition-all rounded-xl px-5 flex-1 font-mono text-center tracking-[0.5em] text-lg"
                                                value={totpCode}
                                                onChange={(e) => setTotpCode(e.target.value)}
                                            />
                                            <button className="linear-btn-primary px-8 h-12 !font-black !uppercase !tracking-widest !text-[11px]" onClick={handleEnableTOTP} disabled={totpLoading}>
                                                {totpLoading ? <Spinner className="animate-spin" /> : t("enable_2fa")}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Password Card */}
                <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-8 space-y-10 shadow-inner">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 shadow-inner">
                            <Lock weight="bold" size={24} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold tracking-tight">{isZh ? "更改登录密码" : "Change Login Password"}</h3>
                            <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold mt-0.5">{isZh ? "Credentials Rotation" : "Credentials Rotation"}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">{t("old_password")}</label>
                            <input
                                type="password"
                                className="!h-12 bg-black/40 border-white/5 focus:border-sky-500/30 transition-all rounded-xl px-5"
                                value={passwordForm.oldPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">{t("new_password")}</label>
                            <input
                                type="password"
                                className="!h-12 bg-black/40 border-white/5 focus:border-sky-500/30 transition-all rounded-xl px-5"
                                value={passwordForm.newPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            />
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-1">{t("confirm_password")}</label>
                            <input
                                type="password"
                                className="!h-12 bg-black/40 border-white/5 focus:border-sky-500/30 transition-all rounded-xl px-5"
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button 
                            className="linear-btn-secondary px-10 h-12 min-w-[160px] font-black uppercase tracking-widest text-[11px]" 
                            disabled={pwdLoading}
                            onClick={handleChangePassword}
                        >
                            {pwdLoading ? <Spinner className="animate-spin" /> : t("password_changed")}
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}
