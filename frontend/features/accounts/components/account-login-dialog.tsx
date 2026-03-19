"use client";

import Image from "next/image";
import { Eye, EyeClosed, PaperPlaneRight, Plus, Spinner, X } from "@phosphor-icons/react";

interface LoginDialogData {
  account_name: string;
  phone_number: string;
  proxy: string;
  phone_code: string;
  phone_code_hash: string;
  password: string;
}

interface QrLoginInfo {
  login_id: string;
  qr_uri: string;
  qr_image?: string | null;
  expires_at: string;
}

type LoginMode = "phone" | "qr";
type QrPhase = "idle" | "loading" | "ready" | "scanning" | "password" | "success" | "expired" | "error";

interface AccountLoginDialogProps {
  open: boolean;
  reloginAccountName: string | null;
  loginMode: LoginMode;
  loginData: LoginDialogData;
  qrLogin: QrLoginInfo | null;
  qrPhase: QrPhase;
  qrMessage: string;
  qrCountdown: number;
  qrLoading: boolean;
  qrPassword: string;
  qrPasswordLoading: boolean;
  proxyTesting: boolean;
  show2FAPassword: boolean;
  loading: boolean;
  t: (key: string) => string;
  onClose: () => void;
  onSetLoginMode: (mode: LoginMode) => void;
  onCancelQrLogin: () => void;
  onChangeLoginData: (next: LoginDialogData) => void;
  onChangeQrPassword: (value: string) => void;
  onToggleQrPasswordVisibility: () => void;
  onSanitizeAccountName: (value: string) => string;
  onStartPhoneLogin: () => void;
  onVerifyPhoneLogin: () => void;
  onTestProxy: (proxy: string) => void;
  onStartQrLogin: () => void;
  onSubmitQrPassword: (password?: string) => void;
}

export function AccountLoginDialog({
  open,
  reloginAccountName,
  loginMode,
  loginData,
  qrLogin,
  qrPhase,
  qrMessage,
  qrCountdown,
  qrLoading,
  qrPassword,
  qrPasswordLoading,
  proxyTesting,
  show2FAPassword,
  loading,
  t,
  onClose,
  onSetLoginMode,
  onCancelQrLogin,
  onChangeLoginData,
  onChangeQrPassword,
  onToggleQrPasswordVisibility,
  onSanitizeAccountName,
  onStartPhoneLogin,
  onVerifyPhoneLogin,
  onTestProxy,
  onStartQrLogin,
  onSubmitQrPassword,
}: AccountLoginDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        className="glass-panel modal-content modal-content-fit !max-w-[440px] !p-0 overflow-hidden animate-zoom-in border-white/5"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Plus weight="bold" size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">{reloginAccountName ? t("relogin_account") : t("add_account")}</h3>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5 font-bold">New Account Session</p>
            </div>
          </div>
          <button className="icon-btn !w-9 !h-9 bg-white/[0.03] hover:bg-white/[0.08]" onClick={onClose}>
            <X weight="bold" size={18} />
          </button>
        </header>

        <div className="p-6 space-y-6">
          <div className="flex p-1 bg-white/[0.03] border border-white/5 rounded-xl gap-1">
            <button
              className={`flex-1 h-9 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                loginMode === "phone" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white/60 hover:bg-white/5"
              }`}
              onClick={() => {
                if (loginMode !== "phone" && qrLogin?.login_id) onCancelQrLogin();
                onSetLoginMode("phone");
              }}
            >
              {t("login_method_phone")}
            </button>
            <button
              className={`flex-1 h-9 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                loginMode === "qr" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white/60 hover:bg-white/5"
              }`}
              onClick={() => onSetLoginMode("qr")}
            >
              {t("login_method_qr")}
            </button>
          </div>

          {loginMode === "phone" ? (
            <>
              <div>
                <label className="text-[11px] mb-1">{t("session_name")}</label>
                <input
                  type="text"
                  className="!py-2.5 !px-4 !mb-4"
                  placeholder={t("account_name_placeholder")}
                  value={loginData.account_name}
                  onChange={(event) => onChangeLoginData({ ...loginData, account_name: onSanitizeAccountName(event.target.value) })}
                />
                <label className="text-[11px] mb-1">{t("phone_number")}</label>
                <input
                  type="text"
                  className="!py-2.5 !px-4 !mb-4"
                  placeholder={t("phone_number_placeholder")}
                  value={loginData.phone_number}
                  onChange={(event) => onChangeLoginData({ ...loginData, phone_number: event.target.value })}
                />
                <label className="text-[11px] mb-1">{t("login_code")}</label>
                <div className="relative !mb-4">
                  <input
                    type="text"
                    className="!py-2.5 !px-4 pr-12"
                    placeholder={t("login_code_placeholder")}
                    value={loginData.phone_code}
                    onChange={(event) => onChangeLoginData({ ...loginData, phone_code: event.target.value })}
                  />
                  <button
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[var(--accent-glow)] hover:bg-white/5 rounded-lg transition-colors"
                    onClick={onStartPhoneLogin}
                    disabled={loading}
                    title={t("send_code")}
                  >
                    {loading ? <Spinner className="animate-spin" size={16} /> : <PaperPlaneRight weight="bold" size={20} />}
                  </button>
                </div>
                <label className="text-[11px] mb-1">{t("two_step_pass")}</label>
                <input
                  type="password"
                  className="!py-2.5 !px-4 !mb-4"
                  placeholder={t("two_step_placeholder")}
                  value={loginData.password}
                  onChange={(event) => onChangeLoginData({ ...loginData, password: event.target.value })}
                />
                <label className="text-[11px] mb-1">{t("proxy")}</label>
                <div className="flex gap-2 !mb-4 items-center relative">
                  <input
                    type="text"
                    className="!py-2.5 !px-4 flex-1"
                    placeholder={t("proxy_placeholder")}
                    style={{ marginBottom: 0 }}
                    value={loginData.proxy}
                    onChange={(event) => onChangeLoginData({ ...loginData, proxy: event.target.value })}
                  />
                  {loginData.proxy ? (
                    <button
                      className="absolute right-16 text-xs text-rose-400 opacity-60 hover:opacity-100"
                      onClick={() => onChangeLoginData({ ...loginData, proxy: "" })}
                      title={t("clear_proxy")}
                    >
                      <X weight="bold" />
                    </button>
                  ) : null}
                  <button className="btn-secondary !h-[42px] px-3 text-xs flex-shrink-0" onClick={() => onTestProxy(loginData.proxy)} disabled={proxyTesting || !loginData.proxy}>
                    {proxyTesting ? <Spinner className="animate-spin" size={16} /> : t("proxy_test")}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button className="linear-btn-secondary flex-1 h-11" onClick={onClose}>{t("cancel")}</button>
                <button className="linear-btn-primary flex-1 h-11 !font-bold" onClick={onVerifyPhoneLogin} disabled={loading || !loginData.phone_code.trim()}>
                  {loading ? <Spinner className="animate-spin" /> : t("confirm_connect")}
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-[11px] mb-1">{t("session_name")}</label>
                <input
                  type="text"
                  className="!py-2.5 !px-4 !mb-4"
                  placeholder={t("account_name_placeholder")}
                  value={loginData.account_name}
                  onChange={(event) => onChangeLoginData({ ...loginData, account_name: onSanitizeAccountName(event.target.value) })}
                />
                <label className="text-[11px] mb-1">{t("two_step_pass")}</label>
                <input
                  type="password"
                  className="!py-2.5 !px-4 !mb-4"
                  placeholder={t("two_step_placeholder")}
                  value={qrPassword}
                  onChange={(event) => onChangeQrPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || qrPhase !== "password" || !qrPassword || qrPasswordLoading) return;
                    event.preventDefault();
                    onSubmitQrPassword(qrPassword);
                  }}
                />
                <label className="text-[11px] mb-1">{t("proxy")}</label>
                <div className="flex gap-2 !mb-4 items-center relative">
                  <input
                    type="text"
                    className="!py-2.5 !px-4 flex-1"
                    placeholder={t("proxy_placeholder")}
                    style={{ marginBottom: 0 }}
                    value={loginData.proxy}
                    onChange={(event) => onChangeLoginData({ ...loginData, proxy: event.target.value })}
                  />
                  {loginData.proxy ? (
                    <button
                      className="absolute right-16 text-xs text-rose-400 opacity-60 hover:opacity-100"
                      onClick={() => onChangeLoginData({ ...loginData, proxy: "" })}
                      title={t("clear_proxy")}
                    >
                      <X weight="bold" />
                    </button>
                  ) : null}
                  <button className="btn-secondary !h-[42px] px-3 text-xs flex-shrink-0" onClick={() => onTestProxy(loginData.proxy)} disabled={proxyTesting || !loginData.proxy}>
                    {proxyTesting ? <Spinner className="animate-spin" size={16} /> : t("proxy_test")}
                  </button>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl space-y-4 shadow-inner">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-main/60">{t("qr_tip")}</div>
                  <button className="btn-secondary h-8 !px-3 !py-0 !text-[11px]" onClick={onStartQrLogin} disabled={qrLoading}>
                    {qrLoading ? <Spinner className="animate-spin" /> : qrLogin ? t("qr_refresh") : t("qr_start")}
                  </button>
                </div>
                <div className="flex items-center justify-center">
                  {qrLogin?.qr_image ? (
                    <Image src={qrLogin.qr_image} alt={t("qr_alt")} width={160} height={160} className="rounded-lg bg-white p-2" />
                  ) : (
                    <div className="w-40 h-40 rounded-lg bg-white/5 flex items-center justify-center text-xs text-main/40">{t("qr_start")}</div>
                  )}
                </div>
                {qrLogin && (qrPhase === "ready" || qrPhase === "scanning") ? (
                  <div className="text-[11px] text-main/40 font-mono text-center">{t("qr_expires_in").replace("{seconds}", qrCountdown.toString())}</div>
                ) : null}
                <div className="text-xs text-center font-bold">
                  {(qrPhase === "loading" || qrPhase === "ready") && t("qr_waiting")}
                  {qrPhase === "scanning" && t("qr_scanned")}
                  {qrPhase === "password" && t("qr_password_required")}
                  {qrPhase === "success" && t("qr_success")}
                  {qrPhase === "expired" && t("qr_expired")}
                  {qrPhase === "error" && t("qr_failed")}
                </div>
                {qrPhase === "password" ? (
                  <div className="relative group">
                    <input
                      type={show2FAPassword ? "text" : "password"}
                      className="!py-2.5 !px-4 !pr-10 bg-white/5 border-white/10 text-sm w-full outline-none focus:border-[#8a3ffc]/50 transition-all rounded-lg"
                      placeholder={t("qr_password_placeholder")}
                      value={qrPassword}
                      onChange={(event) => onChangeQrPassword(event.target.value)}
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-main/30 hover:text-main/60 transition-colors" onClick={onToggleQrPasswordVisibility}>
                      {show2FAPassword ? <EyeClosed size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                ) : null}
                {qrMessage ? <div className="text-[11px] text-rose-400 text-center">{qrMessage}</div> : null}
              </div>

              <div className="flex gap-3 mt-2">
                <button className="btn-secondary flex-1 h-10 !py-0 !text-xs" onClick={onClose}>{t("cancel")}</button>
                <button className="btn-gradient flex-1 h-10 !py-0 !text-xs" onClick={() => onSubmitQrPassword(qrPassword)} disabled={qrPhase !== "password" || !qrPassword || qrPasswordLoading}>
                  {qrPasswordLoading ? <Spinner className="animate-spin" /> : t("confirm_connect")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
