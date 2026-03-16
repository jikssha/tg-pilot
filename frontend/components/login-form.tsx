"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "../lib/api";
import { setToken } from "../lib/auth";
import {
  PaperPlaneTilt,
  Spinner,
  GithubLogo
} from "@phosphor-icons/react";
import { ThemeLanguageToggle } from "./ThemeLanguageToggle";
import { useLanguage } from "../context/LanguageContext";

export default function LoginForm() {
  const router = useRouter();
  const { t } = useLanguage();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await login({ username, password, totp_code: totp || undefined });
      setToken(res.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err?.message || "";
      let displayMsg = t("login_failed");
      const lowerMsg = msg.toLowerCase();

      if (lowerMsg.includes("totp")) {
        displayMsg = t("totp_error");
      } else if (lowerMsg.includes("invalid") || lowerMsg.includes("credentials") || lowerMsg.includes("password")) {
        displayMsg = t("user_or_pass_error");
      } else if (!msg) {
        displayMsg = t("login_failed");
      }
      setErrorMsg(displayMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-view" className="w-full min-h-screen flex flex-col justify-center items-center relative p-4">
      <div className="linear-card w-full max-w-[380px] p-10 flex flex-col items-center">
        
        <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center mb-6 text-[#EDEDED] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <PaperPlaneTilt weight="fill" className="text-xl" />
        </div>
        
        <h2 className="text-xl font-medium text-center mb-1 text-[var(--text-main)]">登录 TG-Pilot</h2>
        <p className="text-xs text-[var(--text-sub)] text-center mb-8">{t("settings_desc")}</p>

        <form onSubmit={handleSubmit} className="w-full text-left" autoComplete="off">
          <div className="mb-5">
            <label className="block text-xs font-medium text-[var(--text-sub)] mb-1.5">{t("username")}</label>
            <input
              type="text"
              name="username"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-[var(--text-main)] transition-all outline-none focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-white/5"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("username")}
              autoComplete="off"
            />
          </div>
          
          <div className="mb-5">
            <label className="block text-xs font-medium text-[var(--text-sub)] mb-1.5">{t("password")}</label>
            <input
              type="password"
              name="password"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-[var(--text-main)] transition-all outline-none focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-white/5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("password")}
              autoComplete="new-password"
            />
          </div>
          
          <div className="mb-8">
            <label className="block text-xs font-medium text-[var(--text-sub)] mb-1.5">{t("totp")} <span className="opacity-50 font-normal">(可选)</span></label>
            <input
              type="text"
              name="totp"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-[var(--text-main)] text-center font-mono tracking-widest transition-all outline-none focus:border-white/20 focus:bg-white/10 focus:ring-2 focus:ring-white/5"
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              placeholder="留空即跳过"
              autoComplete="off"
            />
          </div>

          {errorMsg && (
            <div className="text-[var(--danger)] text-xs mb-5 text-center bg-red-500/10 p-2.5 rounded-md font-medium border border-red-500/20">
              {errorMsg}
            </div>
          )}

          <button className="linear-btn-primary w-full !py-2.5 !text-sm" type="submit" disabled={loading}>
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <Spinner className="animate-spin" size={18} />
                <span>{t("login_loading")}</span>
              </div>
            ) : (
              <span>{t("login")}</span>
            )}
          </button>
        </form>

        <div className="w-full mt-8 flex items-center justify-center gap-6 text-[20px] text-[var(--text-sub)]">
          <ThemeLanguageToggle />
          <a
            href="https://github.com/jikssha/tg-pilot"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--text-main)] transition-colors"
            title={t("github_repo")}
          >
            <GithubLogo />
          </a>
        </div>
      </div>
    </div>
  );
}

