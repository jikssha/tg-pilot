"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getToken } from "../../lib/auth";
import {
  checkAccountsStatus,
  startAccountLogin,
  startQrLogin,
  getQrLoginStatus,
  cancelQrLogin,
  submitQrPassword,
  updateAccount,
  verifyAccountLogin,
  deleteAccount,
  getAccountLogs,
  clearAccountLogs,
  testProxyConnection,
  importSignTask,
  AccountInfo,
  AccountStatusItem,
  AccountLog,
} from "../../lib/api";
import {
  Plus,
  PaperPlaneRight,
  Spinner,
  X,
  PencilSimple,
  Trash,
  Warning,
  TerminalWindow,
  Eye,
  EyeClosed,
  GithubLogo,
  Checks,
  ClipboardText,
  Info
} from "@phosphor-icons/react";
import { ToastContainer, useToast } from "../../components/ui/toast";
import { ThemeLanguageToggle } from "../../components/ThemeLanguageToggle";
import { useLanguage } from "../../context/LanguageContext";
import AccountTasksContent from "./account-tasks/AccountTasksContent";
import { useDashboardOverview } from "@/features/accounts/hooks/use-dashboard-overview";
import { AccountSidebar } from "@/features/accounts/components/account-sidebar";
import { DashboardEmptyState } from "@/features/accounts/components/dashboard-empty-state";
import { AccountDetailPanel } from "@/features/accounts/components/account-detail-panel";
import { EditAccountDialog } from "@/features/accounts/components/edit-account-dialog";
import { BulkImportDialog } from "@/features/accounts/components/bulk-import-dialog";
import { LogsConsoleDialog } from "@/features/accounts/components/logs-console-dialog";
import { AccountLoginDialog } from "@/features/accounts/components/account-login-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const EMPTY_LOGIN_DATA = {
  account_name: "",
  phone_number: "",
  proxy: "",
  phone_code: "",
  password: "",
  phone_code_hash: "",
};
const DASHBOARD_STATUS_CHECKED_KEY = "tg-pilot:dashboard-status-checked";
const DASHBOARD_STATUS_CACHE_KEY = "tg-pilot:dashboard-status-cache";

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [show2FAPassword, setShow2FAPassword] = useState(false);
  // 多选模式状态
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportConfig, setBulkImportConfig] = useState("");
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const router = useRouter();
  const { t, language } = useLanguage();
  const isZh = language === "zh";
  const { toasts, addToast, removeToast } = useToast();
  const [token, setLocalToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAccountName, setSelectedAccountName] = useState<string | null>(null);

  // 日志原生显示 (替代弹窗)
  const [accountLogs, setAccountLogs] = useState<AccountLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [logsAccountName, setLogsAccountName] = useState("");

  // 添加账号对话框
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [loginData, setLoginData] = useState({ ...EMPTY_LOGIN_DATA });
  const [reloginAccountName, setReloginAccountName] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<"phone" | "qr">("phone");
  const [qrLogin, setQrLogin] = useState<{
    login_id: string;
    qr_uri: string;
    qr_image?: string | null;
    expires_at: string;
  } | null>(null);
  type QrPhase = "idle" | "loading" | "ready" | "scanning" | "password" | "success" | "expired" | "error";
  const [qrStatus, setQrStatus] = useState<
    "waiting_scan" | "scanned_wait_confirm" | "password_required" | "success" | "expired" | "failed"
  >("waiting_scan");
  const [qrPhase, setQrPhase] = useState<QrPhase>("idle");
  const [qrMessage, setQrMessage] = useState<string>("");
  const [qrCountdown, setQrCountdown] = useState<number>(0);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrPassword, setQrPassword] = useState("");
  const [qrPasswordLoading, setQrPasswordLoading] = useState(false);
  const [proxyTesting, setProxyTesting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);

  const qrPasswordRef = useRef("");
  const qrPasswordLoadingRef = useRef(false);

  const qrPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrPollDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrActiveLoginIdRef = useRef<string | null>(null);
  const qrPollSeqRef = useRef(0);
  const qrToastShownRef = useRef<Record<string, { expired?: boolean; error?: boolean }>>({});
  const qrPollingActiveRef = useRef(false);
  const qrRestartingRef = useRef(false);
  const qrAutoRefreshRef = useRef(0);

  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);

  useEffect(() => {
    qrPasswordRef.current = qrPassword;
  }, [qrPassword]);

  useEffect(() => {
    qrPasswordLoadingRef.current = qrPasswordLoading;
  }, [qrPasswordLoading]);

  // 编辑账号对话框
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editData, setEditData] = useState({
    account_name: "",
    remark: "",
    proxy: "",
  });

  const handleCloseEditDialog = useCallback(() => {
    setShowEditDialog(false);
    setEditData({ account_name: "", remark: "", proxy: "" });
  }, []);

  const handleTestProxy = useCallback(async (proxyValue: string) => {
    if (!token) return;
    if (!proxyValue.trim()) {
      addToast(t("form_incomplete"), "error");
      return;
    }
    setProxyTesting(true);
    try {
      const res = await testProxyConnection(token, { proxy: proxyValue });
      if (res.success) {
        addToast(t("proxy_test_success"), "success");
      } else {
        addToast(res.message || t("proxy_test_failed"), "error");
      }
    } catch (err: any) {
      addToast(t("proxy_test_failed"), "error");
    } finally {
      setProxyTesting(false);
    }
  }, [token, t, addToast]);

  const normalizeAccountName = useCallback((name: string) => name.trim(), []);

  const sanitizeAccountName = (name: string) =>
    name.replace(/[^A-Za-z0-9\u4e00-\u9fff]/g, "");

  const [checking, setChecking] = useState(true);
  const [accountStatusMap, setAccountStatusMap] = useState<Record<string, AccountStatusItem>>({});
  const statusCheckedRef = useRef(false);
  const dashboardOverview = useDashboardOverview(token);
  const accounts = dashboardOverview.accounts;
  const tasks = dashboardOverview.tasks;
  const appVersion = dashboardOverview.appVersion;
  const dataLoaded = dashboardOverview.isFetched;
  const dashboardLoading = dashboardOverview.isLoading && accounts.length === 0;
  const refetchDashboardOverview = dashboardOverview.refetch;

  const isDuplicateAccountName = useCallback((name: string, allowedSameName?: string | null) => {
    const normalized = normalizeAccountName(name).toLowerCase();
    if (!normalized) return false;
    const allow = normalizeAccountName(allowedSameName || "").toLowerCase();
    return accounts.some((acc) => {
      const current = acc.name.toLowerCase();
      if (allow && current === allow && normalized === allow) {
        return false;
      }
      return current === normalized;
    });
  }, [accounts, normalizeAccountName]);

  const addToastRef = useRef(addToast);
  const tRef = useRef(t);

  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const formatErrorMessage = useCallback((key: string, err?: any) => {
    const base = tRef.current ? tRef.current(key) : key;
    const code = err?.code;
    return code ? `${base} (${code})` : base;
  }, []);

  const shouldRunStatusCheck = useCallback(() => {
    if (typeof window === "undefined") return true;

    let navType = "";
    try {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      navType = nav?.type || "";
    } catch {
      navType = "";
    }

    if (navType === "reload") {
      return true;
    }

    try {
      return sessionStorage.getItem(DASHBOARD_STATUS_CHECKED_KEY) !== "1";
    } catch {
      return true;
    }
  }, []);

  const restoreCachedStatus = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(DASHBOARD_STATUS_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
      setAccountStatusMap(parsed as Record<string, AccountStatusItem>);
    } catch {
      // ignore cache parse errors
    }
  }, []);

  const checkAccountStatusOnce = useCallback(async (tokenStr: string, accountList: AccountInfo[]) => {
    const accountNames = accountList.map((item) => item.name).filter(Boolean);
    if (accountNames.length === 0) {
      setAccountStatusMap({});
      return;
    }

    setAccountStatusMap((prev) => {
      const next = { ...prev };
      for (const name of accountNames) {
        next[name] = {
          account_name: name,
          ok: false,
          status: "checking",
          message: "",
          needs_relogin: false,
        };
      }
      return next;
    });

    try {
      const firstPass = await checkAccountsStatus(tokenStr, {
        account_names: accountNames,
        timeout_seconds: 8,
      });

      const firstMap: Record<string, AccountStatusItem> = {};
      for (const item of firstPass.results || []) {
        firstMap[item.account_name] = item;
      }

      const retryNames = accountNames.filter((name) => {
        const item = firstMap[name];
        if (!item) return true;
        if (item.needs_relogin) return false;
        return item.status === "error" || item.status === "checking";
      });

      const retryMap: Record<string, AccountStatusItem> = {};
      if (retryNames.length > 0) {
        try {
          const retryPass = await checkAccountsStatus(tokenStr, {
            account_names: retryNames,
            timeout_seconds: 12,
          });
          for (const item of retryPass.results || []) {
            retryMap[item.account_name] = item;
          }
        } catch {
          // keep first-pass result
        }
      }

      setAccountStatusMap((prev) => {
        const merged: Record<string, AccountStatusItem> = {};
        for (const name of accountNames) {
          const incomingRaw = retryMap[name] || firstMap[name];
          const incoming =
            incomingRaw && incomingRaw.status === "error" && !incomingRaw.needs_relogin
              ? { ...incomingRaw, status: "checking" as const }
              : incomingRaw;
          if (incoming) {
            const prevItem = prev[name];
            if (
              incoming.status === "error" &&
              !incoming.needs_relogin &&
              prevItem?.status === "connected"
            ) {
              merged[name] = prevItem;
              continue;
            }
            merged[name] = incoming;
            continue;
          }
          merged[name] = prev[name] || {
            account_name: name,
            ok: false,
            status: "checking",
            message: "",
            needs_relogin: false,
          };
        }
        return merged;
      });
    } catch {
      setAccountStatusMap((prev) => {
        const merged: Record<string, AccountStatusItem> = {};
        for (const name of accountNames) {
          merged[name] = prev[name] || {
            account_name: name,
            ok: false,
            status: "checking",
            message: "",
            needs_relogin: false,
          };
        }
        return merged;
      });
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      await refetchDashboardOverview();
    } catch (err: any) {
      addToastRef.current(formatErrorMessage("load_failed", err), "error");
    }
  }, [formatErrorMessage, refetchDashboardOverview]);

  useEffect(() => {
    const tokenStr = getToken();
    if (!tokenStr) {
      window.location.replace("/");
      return;
    }
    setLocalToken(tokenStr);
    setChecking(false);
    statusCheckedRef.current = false;
    // 不再恢复 sessionStorage 中缓存的旧状态，避免误显示"登录失效"
    // restoreCachedStatus();
    void refetchDashboardOverview();
  }, [refetchDashboardOverview, restoreCachedStatus]);
  useEffect(() => {
    if (!token || !dataLoaded || accounts.length === 0) {
      if (dataLoaded && accounts.length === 0) setAccountStatusMap({});
      return;
    }
    if (statusCheckedRef.current) return;
    
    if (shouldRunStatusCheck()) {
      statusCheckedRef.current = true;
      try {
        sessionStorage.setItem(DASHBOARD_STATUS_CHECKED_KEY, "1");
      } catch {
        // ignore
      }
      checkAccountStatusOnce(token, accounts);
    } else {
      statusCheckedRef.current = true;
    }
  }, [token, dataLoaded, accounts, checkAccountStatusOnce, shouldRunStatusCheck]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const keys = Object.keys(accountStatusMap || {});
    if (keys.length === 0) return;
    try {
      sessionStorage.setItem(DASHBOARD_STATUS_CACHE_KEY, JSON.stringify(accountStatusMap));
    } catch {
      // ignore storage write errors
    }
  }, [accountStatusMap]);

  const getAccountTaskCount = (accountName: string) => {
    return tasks.filter(task => task.account_name === accountName).length;
  };

  const openAddDialog = () => {
    setReloginAccountName(null);
    setLoginMode("phone");
    setLoginData({ ...EMPTY_LOGIN_DATA });
    setShowAddDialog(true);
  };

  const handleStartLogin = async () => {
    if (!token) return;
    const trimmedAccountName = normalizeAccountName(loginData.account_name);
    if (!trimmedAccountName || !loginData.phone_number) {
      addToast(t("account_name_phone_required"), "error");
      return;
    }
    if (isDuplicateAccountName(trimmedAccountName, reloginAccountName)) {
      addToast(t("account_name_duplicate"), "error");
      return;
    }
    try {
      setLoading(true);
      const res = await startAccountLogin(token, {
        phone_number: loginData.phone_number,
        account_name: trimmedAccountName,
        proxy: loginData.proxy || undefined,
      });
      setLoginData({ ...loginData, account_name: trimmedAccountName, phone_code_hash: res.phone_code_hash });
      addToast(t("code_sent"), "success");
    } catch (err: any) {
      addToast(formatErrorMessage("send_code_failed", err), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLogin = useCallback(async () => {
    if (!token) return;
    if (!loginData.phone_code) {
      addToast(t("login_code_required"), "error");
      return;
    }
    const trimmedAccountName = normalizeAccountName(loginData.account_name);
    if (!trimmedAccountName) {
      addToast(t("account_name_required"), "error");
      return;
    }
    if (isDuplicateAccountName(trimmedAccountName, reloginAccountName)) {
      addToast(t("account_name_duplicate"), "error");
      return;
    }
    try {
      setLoading(true);
      await verifyAccountLogin(token, {
        account_name: trimmedAccountName,
        phone_number: loginData.phone_number,
        phone_code: loginData.phone_code,
        phone_code_hash: loginData.phone_code_hash,
        password: loginData.password || undefined,
        proxy: loginData.proxy || undefined,
      });
      addToast(t("login_success"), "success");
      setAccountStatusMap((prev) => ({
        ...prev,
        [trimmedAccountName]: {
          account_name: trimmedAccountName,
          ok: true,
          status: "connected",
          message: "",
          code: "OK",
          checked_at: new Date().toISOString(),
          needs_relogin: false,
        },
      }));
      setReloginAccountName(null);
      setLoginData({ ...EMPTY_LOGIN_DATA });
      setShowAddDialog(false);
      void loadData();
    } catch (err: any) {
      addToast(formatErrorMessage("verify_failed", err), "error");
    } finally {
      setLoading(false);
    }
  }, [
    token,
    loginData.account_name,
    loginData.phone_number,
    loginData.phone_code,
    loginData.phone_code_hash,
    loginData.password,
    loginData.proxy,
    addToast,
    formatErrorMessage,
    isDuplicateAccountName,
    loadData,
    normalizeAccountName,
    reloginAccountName,
    t,
  ]);

  const handleDeleteAccount = async () => {
    if (!token || !accountToDelete) return;
    try {
      setLoading(true);
      await deleteAccount(token, accountToDelete);
      addToast(t("account_deleted"), "success");
      setShowDeleteConfirm(false);
      setAccountToDelete(null);
      void loadData();
    } catch (err: any) {
      addToast(formatErrorMessage("delete_failed", err), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditAccount = (acc: AccountInfo) => {
    setEditData({
      account_name: acc.name,
      remark: acc.remark || "",
      proxy: acc.proxy || "",
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!token) return;
    if (!editData.account_name) return;
    try {
      setLoading(true);
      await updateAccount(token, editData.account_name, {
        remark: editData.remark || "",
        proxy: editData.proxy || "",
      });
      addToast(t("save_changes"), "success");
      setShowEditDialog(false);
      void loadData();
    } catch (err: any) {
      addToast(formatErrorMessage("save_failed", err), "error");
    } finally {
      setLoading(false);
    }
  };

  const debugQr = useCallback((payload: Record<string, any>) => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[qr-login]", payload);
    }
  }, []);

  const clearQrPollingTimers = useCallback(() => {
    if (qrPollTimerRef.current) {
      clearInterval(qrPollTimerRef.current);
      qrPollTimerRef.current = null;
    }
    if (qrPollDelayRef.current) {
      clearTimeout(qrPollDelayRef.current);
      qrPollDelayRef.current = null;
    }
    qrPollingActiveRef.current = false;
  }, []);

  const clearQrCountdownTimer = useCallback(() => {
    if (qrCountdownTimerRef.current) {
      clearInterval(qrCountdownTimerRef.current);
      qrCountdownTimerRef.current = null;
    }
  }, []);

  const clearQrTimers = useCallback(() => {
    clearQrPollingTimers();
    clearQrCountdownTimer();
  }, [clearQrPollingTimers, clearQrCountdownTimer]);

  const setQrPhaseSafe = useCallback((next: QrPhase, reason: string, extra?: Record<string, any>) => {
    setQrPhase((prev) => {
      if (prev !== next) {
        debugQr({
          login_id: qrActiveLoginIdRef.current,
          prev,
          next,
          reason,
          ...extra,
        });
      }
      return next;
    });
  }, [debugQr]);

  const markToastShown = useCallback((loginId: string, kind: "expired" | "error") => {
    if (!loginId) return;
    if (!qrToastShownRef.current[loginId]) {
      qrToastShownRef.current[loginId] = {};
    }
    qrToastShownRef.current[loginId][kind] = true;
  }, []);

  const hasToastShown = useCallback((loginId: string, kind: "expired" | "error") => {
    if (!loginId) return false;
    return Boolean(qrToastShownRef.current[loginId]?.[kind]);
  }, []);

  const resetQrState = useCallback(() => {
    clearQrTimers();
    qrActiveLoginIdRef.current = null;
    qrRestartingRef.current = false;
    qrAutoRefreshRef.current = 0;
    setQrLogin(null);
    setQrStatus("waiting_scan");
    setQrPhase("idle");
    setQrMessage("");
    setQrCountdown(0);
    setQrLoading(false);
    setQrPassword("");
    setQrPasswordLoading(false);
  }, [clearQrTimers]);

  const openReloginDialog = useCallback((acc: AccountInfo) => {
    resetQrState();
    setReloginAccountName(acc.name);
    setLoginMode("phone");
    setLoginData({
      ...EMPTY_LOGIN_DATA,
      account_name: acc.name,
      proxy: acc.proxy || "",
    });
    setShowAddDialog(true);
    addToast(t("account_relogin_required"), "error");
  }, [addToast, resetQrState, t]);

  const handleAccountCardClick = useCallback((acc: AccountInfo) => {
    const statusInfo = accountStatusMap[acc.name];
    if (statusInfo?.needs_relogin) {
      openReloginDialog(acc);
      return;
    }
    router.push(`/dashboard/account-tasks?name=${acc.name}`);
  }, [accountStatusMap, openReloginDialog, router]);

  const performQrLoginStart = useCallback(async (options?: { autoRefresh?: boolean; silent?: boolean; reason?: string }) => {
    if (!token) return null;
    const trimmedAccountName = normalizeAccountName(loginData.account_name);
    if (!trimmedAccountName) {
      if (!options?.silent) {
        addToast(t("account_name_required"), "error");
      }
      return null;
    }
    if (isDuplicateAccountName(trimmedAccountName, reloginAccountName)) {
      if (!options?.silent) {
        addToast(t("account_name_duplicate"), "error");
      }
      return null;
    }
    try {
      if (options?.autoRefresh) {
        qrRestartingRef.current = true;
      }
      clearQrTimers();
      setQrLoading(true);
      setQrPhaseSafe("loading", options?.reason ?? "start");
      const res = await startQrLogin(token, {
        account_name: trimmedAccountName,
        proxy: loginData.proxy || undefined,
      });
      setLoginData((prev) => ({ ...prev, account_name: trimmedAccountName }));
      setQrLogin(res);
      qrActiveLoginIdRef.current = res.login_id;
      qrToastShownRef.current[res.login_id] = {};
      setQrStatus("waiting_scan");
      setQrPhaseSafe("ready", "qr_ready", { expires_at: res.expires_at });
      setQrMessage("");
      return res;
    } catch (err: any) {
      setQrPhaseSafe("error", "start_failed");
      if (!options?.silent) {
        addToast(formatErrorMessage("qr_create_failed", err), "error");
      }
      return null;
    } finally {
      setQrLoading(false);
      qrRestartingRef.current = false;
    }
  }, [
    token,
    loginData.account_name,
    loginData.proxy,
    addToast,
    clearQrTimers,
    formatErrorMessage,
    isDuplicateAccountName,
    normalizeAccountName,
    reloginAccountName,
    setQrPhaseSafe,
    t,
  ]);

  const handleSubmitQrPassword = useCallback(async (passwordOverride?: string) => {
    if (!token || !qrLogin?.login_id) return;
    const passwordValue = passwordOverride ?? qrPasswordRef.current;
    if (!passwordValue) {
      const msg = t("qr_password_missing");
      addToast(msg, "error");
      setQrMessage(msg);
      return;
    }
    try {
      setQrPasswordLoading(true);
      await submitQrPassword(token, {
        login_id: qrLogin.login_id,
        password: passwordValue,
      });
      addToast(t("login_success"), "success");
      const doneAccount = normalizeAccountName(loginData.account_name);
      if (doneAccount) {
        setAccountStatusMap((prev) => ({
          ...prev,
          [doneAccount]: {
            account_name: doneAccount,
            ok: true,
            status: "connected",
            message: "",
            code: "OK",
            checked_at: new Date().toISOString(),
            needs_relogin: false,
          },
        }));
      }
      setReloginAccountName(null);
      setLoginData({ ...EMPTY_LOGIN_DATA });
      resetQrState();
      setShowAddDialog(false);
      void loadData();
    } catch (err: any) {
      const errMsg = err?.message ? String(err.message) : "";
      const fallback = formatErrorMessage("qr_login_failed", err);
      let message = errMsg || fallback;
      const lowerMsg = errMsg.toLowerCase();
      if (errMsg.includes("瀵嗙爜閿欒") || errMsg.includes("涓两楠岃瘉") || lowerMsg.includes("2fa")) {
        message = t("qr_password_invalid");
      }
      addToast(message, "error");
      if (message === t("qr_password_invalid")) {
        resetQrState();
        return;
      }
      setQrMessage(message);
    } finally {
      setQrPasswordLoading(false);
    }
  }, [
    token,
    qrLogin?.login_id,
    addToast,
    resetQrState,
    loadData,
    t,
    formatErrorMessage,
    loginData.account_name,
    normalizeAccountName,
  ]);

  const startQrPolling = useCallback((loginId: string, reason: string = "effect") => {
    if (!token || !loginId) return;
    if (loginMode !== "qr" || !showAddDialog) return;
    if (qrPollingActiveRef.current && qrActiveLoginIdRef.current === loginId) {
      debugQr({ login_id: loginId, poll: "skip", reason });
      return;
    }

    clearQrPollingTimers();
    qrActiveLoginIdRef.current = loginId;
    qrPollingActiveRef.current = true;
    qrPollSeqRef.current += 1;
    const seq = qrPollSeqRef.current;
    let stopped = false;

    const stopPolling = () => {
      if (stopped) return;
      stopped = true;
      clearQrPollingTimers();
    };

    const shouldAutoRefresh = () => {
      const now = Date.now();
      if (now - qrAutoRefreshRef.current < 1200) {
        return false;
      }
      qrAutoRefreshRef.current = now;
      return true;
    };

    const poll = async () => {
      try {
        if (qrRestartingRef.current) return;
        const res = await getQrLoginStatus(token, loginId);
        if (stopped) return;
        if (qrActiveLoginIdRef.current !== loginId) return;
        if (qrPollSeqRef.current !== seq) return;

        const status = res.status as "waiting_scan" | "scanned_wait_confirm" | "password_required" | "success" | "expired" | "failed";
        debugQr({ login_id: loginId, pollResult: status, message: res.message || "" });
        setQrStatus(status);
        if (status !== "password_required") {
          setQrMessage("");
        }
        if (res.expires_at) {
          setQrLogin((prev) => (prev ? { ...prev, expires_at: res.expires_at } : prev));
        }

        if (status === "success") {
          setQrPhaseSafe("success", "poll_success", { status });
          addToast(t("login_success"), "success");
          const doneAccount = normalizeAccountName(loginData.account_name);
          if (doneAccount) {
            setAccountStatusMap((prev) => ({
              ...prev,
              [doneAccount]: {
                account_name: doneAccount,
                ok: true,
                status: "connected",
                message: "",
                code: "OK",
                checked_at: new Date().toISOString(),
                needs_relogin: false,
              },
            }));
          }
          setReloginAccountName(null);
          setLoginData({ ...EMPTY_LOGIN_DATA });
          stopPolling();
          resetQrState();
          setShowAddDialog(false);
          void loadData();
          return;
        }

        if (status === "password_required") {
          setQrPhaseSafe("password", "poll_password_required", { status });
          stopPolling();
          setQrMessage(t("qr_password_required"));
          return;
        }

        if (status === "scanned_wait_confirm") {
          setQrPhaseSafe("scanning", "poll_scanned", { status });
          return;
        }

        if (status === "waiting_scan") {
          setQrPhaseSafe("ready", "poll_waiting", { status });
          return;
        }

        if (status === "expired") {
          stopPolling();
          setQrPhaseSafe("loading", "auto_refresh", { status });
          if (!shouldAutoRefresh()) {
            return;
          }
          const refreshed = await performQrLoginStart({
            autoRefresh: true,
            silent: true,
            reason: "auto_refresh",
          });
          if (refreshed?.login_id) {
            startQrPolling(refreshed.login_id, "auto_refresh");
            return;
          }
          setQrPhaseSafe("expired", "auto_refresh_failed", { status });
          if (!hasToastShown(loginId, "expired")) {
            addToast(t("qr_expired_not_found"), "error");
            markToastShown(loginId, "expired");
          }
          return;
        }

        if (status === "failed") {
          setQrPhaseSafe("error", "poll_terminal", { status });
          stopPolling();
          if (!hasToastShown(loginId, "error")) {
            addToast(t("qr_login_failed"), "error");
            markToastShown(loginId, "error");
          }
        }
      } catch (err: any) {
        if (stopped) return;
        if (qrActiveLoginIdRef.current !== loginId) return;
        if (qrPollSeqRef.current !== seq) return;
        debugQr({ login_id: loginId, pollError: err?.message || String(err) });
        if (!hasToastShown(loginId, "error")) {
          addToast(formatErrorMessage("qr_status_failed", err), "error");
          markToastShown(loginId, "error");
        }
      }
    };

    qrPollDelayRef.current = setTimeout(() => {
      poll();
      qrPollTimerRef.current = setInterval(poll, 1500);
    }, 0);

    return stopPolling;
  }, [
    token,
    loginMode,
    showAddDialog,
    addToast,
    clearQrPollingTimers,
    debugQr,
    formatErrorMessage,
    hasToastShown,
    loadData,
    markToastShown,
    loginData.account_name,
    normalizeAccountName,
    performQrLoginStart,
    resetQrState,
    setQrPhaseSafe,
    t,
  ]);

  const handleStartQrLogin = async () => {
    const res = await performQrLoginStart();
    if (res?.login_id) {
      startQrPolling(res.login_id, "start_success");
    }
  };

  const handleCancelQrLogin = async () => {
    if (!token || !qrLogin?.login_id) {
      resetQrState();
      return;
    }
    try {
      setQrLoading(true);
      await cancelQrLogin(token, qrLogin.login_id);
    } catch (err: any) {
      addToast(formatErrorMessage("cancel_failed", err), "error");
    } finally {
      setQrLoading(false);
      resetQrState();
    }
  };


  // 手动提交 2FA（避免自动重试导致重复请求）

  const handleCloseAddDialog = () => {
    if (qrLogin?.login_id) {
      handleCancelQrLogin();
    }
    setReloginAccountName(null);
    setLoginData({ ...EMPTY_LOGIN_DATA });
    setLoginMode("phone");
    setShowAddDialog(false);
  };



  useEffect(() => {
    if (!qrLogin?.expires_at || !qrActiveLoginIdRef.current) {
      setQrCountdown(0);
      clearQrTimers();
      return;
    }
    if (!(qrPhase === "ready" || qrPhase === "scanning")) {
      setQrCountdown(0);
      if (qrCountdownTimerRef.current) {
        clearInterval(qrCountdownTimerRef.current);
        qrCountdownTimerRef.current = null;
      }
      return;
    }
    const update = () => {
      const expires = new Date(qrLogin.expires_at).getTime();
      const diff = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setQrCountdown(diff);
    };
    update();
    if (qrCountdownTimerRef.current) {
      clearInterval(qrCountdownTimerRef.current);
    }
    qrCountdownTimerRef.current = setInterval(update, 1000);
    return () => {
      if (qrCountdownTimerRef.current) {
        clearInterval(qrCountdownTimerRef.current);
        qrCountdownTimerRef.current = null;
      }
    };
  }, [qrLogin?.expires_at, qrPhase, clearQrTimers]);

  useEffect(() => {
    if (!token || !qrLogin?.login_id || loginMode !== "qr" || !showAddDialog) return;
    if (qrPhase === "success" || qrPhase === "expired" || qrPhase === "error" || qrPhase === "password") return;
    if (qrRestartingRef.current) return;
    const stop = startQrPolling(qrLogin.login_id, "effect");
    return () => {
      if (stop) stop();
    };
  }, [token, qrLogin?.login_id, loginMode, showAddDialog, qrPhase, startQrPolling]);

  // 如果初次加载没有选定账号且有账号存在，自动选定第一个
  useEffect(() => {
    if (!selectedAccountName && accounts.length > 0) {
      setSelectedAccountName(accounts[0].name);
    } else if (accounts.length === 0 && selectedAccountName) {
      setSelectedAccountName(null);
    }
  }, [accounts, selectedAccountName]);

  const handleShowLogs = async (accountName: string) => {
    if (!token) return;
    setLogsAccountName(accountName);
    setShowLogsDialog(true);
    setLogsLoading(true);
    try {
      const logs = await getAccountLogs(token, accountName);
      setAccountLogs(logs || []);
    } catch (err: any) {
      addToast(formatErrorMessage("fetch_logs_failed", err), "error");
    } finally {
      setLogsLoading(false);
    }
  };

  const handleClearLogs = () => {
    if (!token || !logsAccountName) return;
    setShowClearLogsConfirm(true);
  };

  const confirmClearLogs = async () => {
    if (!token || !logsAccountName) return;
    try {
      setLogsLoading(true);
      await clearAccountLogs(token, logsAccountName);
      setAccountLogs([]);
      addToast(isZh ? "日志已清空" : "Logs cleared", "success");
      setShowClearLogsConfirm(false);
    } catch (err: any) {
      addToast(formatErrorMessage("clear_failed", err), "error");
    } finally {
      setLogsLoading(false);
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedAccounts(new Set());
  };

  const toggleAccountSelection = (name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = new Set(selectedAccounts);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setSelectedAccounts(next);
  };

  const toggleSelectAll = () => {
    if (selectedAccounts.size === accounts.length) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(accounts.map(a => a.name)));
    }
  };

  const handleBulkImportSubmit = async () => {
    if (!token || !bulkImportConfig.trim()) return;
    try {
      setBulkImportLoading(true);
      const accountList = Array.from(selectedAccounts).sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      );
      let successCount = 0;
      let failCount = 0;

      // 解析导入内容，支持单任务对象或多任务数组
      let configsToImport: any[] = [];
      try {
        const parsed = JSON.parse(bulkImportConfig);
        configsToImport = Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        addToast(isZh ? "JSON 格式错误，请检查配置内容" : "Invalid JSON format", "error");
        return;
      }

      for (const accName of accountList) {
        for (const config of configsToImport) {
          try {
            // 如果 config 是字符串则直接使用，否则转为字符串
            const configStr = typeof config === 'string' ? config : JSON.stringify(config);
            await importSignTask(token, configStr, undefined, accName);
            successCount++;
          } catch (err) {
            console.error(`Import failed for ${accName}:`, err);
            failCount++;
          }
        }
      }

      addToast(
        isZh 
          ? `批量分发完成！共处理 ${configsToImport.length} 个任务，成功部署 ${successCount} 次` 
          : `Bulk distribution complete! Handled ${configsToImport.length} tasks, successfully deployed ${successCount} times`,
        failCount > 0 ? "info" : "success"
      );
      
      setShowBulkImport(false);
      setBulkImportConfig("");
      // 为了方便连续操作，不再自动退出多选模式和清除选中状态
      // setIsSelectionMode(false);
      // setSelectedAccounts(new Set());
      
      // 刷新数据
      void loadData();
      if (selectedAccountName) {
         // 可选：触发内部组件刷新
      }
    } catch (err: any) {
      addToast(formatErrorMessage("import_failed", err), "error");
    } finally {
      setBulkImportLoading(false);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[var(--accent-glow)]/20 border-t-[var(--accent-glow)] rounded-full animate-spin"></div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--accent-glow)]/40 font-bold animate-pulse">
            System Initializing
          </div>
        </div>
      </div>
    );
  }

  const selectedAccount = accounts.find((a) => a.name === selectedAccountName);
  const selectedStatus = selectedAccountName ? accountStatusMap[selectedAccountName] : null;

  return (
    <div id="dashboard-view" className="w-full h-full flex overflow-hidden bg-[var(--bg-body)]">
      
      {/* 侧边栏 (Sidebar) */}
      <AccountSidebar
        accounts={accounts}
        loading={dashboardLoading}
        appVersion={appVersion}
        isSelectionMode={isSelectionMode}
        selectedAccounts={selectedAccounts}
        selectedAccountName={selectedAccountName}
        accountStatusMap={accountStatusMap}
        isZh={isZh}
        t={t}
        getAccountTaskCount={getAccountTaskCount}
        onToggleSelectionMode={toggleSelectionMode}
        onOpenAddDialog={openAddDialog}
        onSelectAccount={handleAccountCardClick}
        onToggleAccountSelection={toggleAccountSelection}
      />

      {/* 工作区 (Detail Area) */}
      <main className="flex-1 flex flex-col bg-[#0E0E0E] overflow-hidden relative">
        <header className="h-[52px] px-6 flex items-center justify-between border-b border-[var(--border-color)] bg-[#0E0E0E]/90 backdrop-blur-md z-10 shrink-0">
            <div className="flex items-center gap-3 text-sm font-medium text-[var(--text-sub)]">
                <span>账号管理</span>
                {selectedAccount && (
                  <>
                    <span className="text-[#333]">/</span>
                    <span className="text-[var(--text-main)]">{selectedAccount.name}</span>
                  </>
                )}
            </div>
            <div className="flex items-center gap-2">
                <a
                  href="https://github.com/jikssha/tg-pilot"
                  target="_blank"
                  rel="noreferrer"
                  className="action-btn"
                  title={t("github_repo")}
                >
                  <GithubLogo weight="bold" />
                </a>
                <ThemeLanguageToggle />
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 lg:p-12 w-full max-w-5xl mx-auto custom-scrollbar">
          {!selectedAccount ? (
            <DashboardEmptyState t={t} onAddAccount={openAddDialog} />
          ) : (
            <AccountDetailPanel
              selectedAccount={selectedAccount}
              selectedStatus={selectedStatus}
              isZh={isZh}
              t={t}
              onShowLogs={handleShowLogs}
              onShowDelete={(accountName) => {
                setAccountToDelete(accountName);
                setShowDeleteConfirm(true);
              }}
              onRelogin={openReloginDialog}
              onEditAccount={handleEditAccount}
            >
              <AccountTasksContent embedded={true} initialAccountName={selectedAccount.name} />
            </AccountDetailPanel>
          )}
        </div>
      </main>

      <AccountLoginDialog
        open={showAddDialog}
        reloginAccountName={reloginAccountName}
        loginMode={loginMode}
        loginData={loginData}
        qrLogin={qrLogin}
        qrPhase={qrPhase}
        qrMessage={qrMessage}
        qrCountdown={qrCountdown}
        qrLoading={qrLoading}
        qrPassword={qrPassword}
        qrPasswordLoading={qrPasswordLoading}
        proxyTesting={proxyTesting}
        show2FAPassword={show2FAPassword}
        loading={loading}
        t={t}
        onClose={handleCloseAddDialog}
        onSetLoginMode={setLoginMode}
        onCancelQrLogin={handleCancelQrLogin}
        onChangeLoginData={setLoginData}
        onChangeQrPassword={setQrPassword}
        onToggleQrPasswordVisibility={() => setShow2FAPassword(!show2FAPassword)}
        onSanitizeAccountName={sanitizeAccountName}
        onStartPhoneLogin={handleStartLogin}
        onVerifyPhoneLogin={handleVerifyLogin}
        onTestProxy={handleTestProxy}
        onStartQrLogin={handleStartQrLogin}
        onSubmitQrPassword={handleSubmitQrPassword}
      />

      <EditAccountDialog
        open={showEditDialog}
        title={t("edit_account")}
        accountName={editData.account_name}
        remark={editData.remark}
        proxy={editData.proxy}
        isSaving={loading}
        proxyTesting={proxyTesting}
        t={t}
        onClose={handleCloseEditDialog}
        onSave={handleSaveEdit}
        onRemarkChange={(value) => setEditData((prev) => ({ ...prev, remark: value }))}
        onProxyChange={(value) => setEditData((prev) => ({ ...prev, proxy: value }))}
        onClearProxy={() => setEditData((prev) => ({ ...prev, proxy: "" }))}
        onTestProxy={handleTestProxy}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        title={t("confirm_delete")}
        description={t("confirm_delete_account").replace("{name}", accountToDelete || "")}
        hint={isZh ? "此操作不可撤销" : "This action is permanent"}
        icon={
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]">
            <Trash weight="bold" size={32} />
          </div>
        }
        cancelLabel={t("cancel")}
        confirmLabel={t("delete")}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setAccountToDelete(null);
        }}
        onConfirm={handleDeleteAccount}
        cancelDisabled={loading}
        confirmDisabled={loading}
        confirmIcon={loading ? <Spinner className="animate-spin" /> : <Trash weight="bold" size={16} />}
        confirmClassName="bg-rose-500 hover:bg-rose-600 active:scale-95 text-white flex-1 h-11 rounded-lg font-bold text-[13px] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      />

      <ConfirmDialog
        open={showClearLogsConfirm}
        title={isZh ? "确认清空日志" : "Purge Command Logs"}
        description={isZh ? "确定要清空该账户的所有运行日志吗？该操作不可撤销。" : "Are you sure you want to clear all logs for this account? This action cannot be undone."}
        hint="Permanent cleanup sequence initiated"
        icon={
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
            <TerminalWindow weight="bold" size={20} />
          </div>
        }
        cancelLabel={t("cancel")}
        confirmLabel={isZh ? "立即清空" : "Purge Now"}
        onCancel={() => setShowClearLogsConfirm(false)}
        onConfirm={confirmClearLogs}
        cancelDisabled={logsLoading}
        confirmDisabled={logsLoading}
        confirmIcon={logsLoading ? <Spinner className="animate-spin text-white" /> : <Trash weight="bold" size={16} />}
        confirmClassName="flex-1 h-11 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl font-black uppercase tracking-widest text-[11px] shadow-[0_4px_20px_rgba(245,158,11,0.2)] transition-all flex items-center justify-center gap-2"
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* 批量操作悬浮条 */}
      {isSelectionMode && selectedAccounts.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-float-up">
          <div className="glass-panel !bg-black/60 !backdrop-blur-xl border border-white/20 px-6 py-3 rounded-full flex items-center gap-6 shadow-2xl">
            <div className="flex items-center gap-3 pr-6 border-r border-white/10">
              <button 
                 onClick={toggleSelectAll}
                 className="w-5 h-5 rounded border border-white/20 flex items-center justify-center hover:border-sky-400 transition-colors"
              >
                {selectedAccounts.size === accounts.length ? <Checks weight="bold" className="text-sky-400" /> : null}
              </button>
              <div className="text-xs font-bold whitespace-nowrap">
                {isZh ? `已选中 ${selectedAccounts.size} 个` : `Selected ${selectedAccounts.size}`}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 active:scale-95"
                onClick={() => setShowBulkImport(true)}
              >
                <ClipboardText weight="bold" />
                {isZh ? "一键导入任务" : "Bulk Import"}
              </button>
              <button 
                className="text-main/40 hover:text-white px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                onClick={toggleSelectionMode}
              >
                {isZh ? "取消" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量导入弹窗 */}
      <BulkImportDialog
        open={showBulkImport}
        isZh={isZh}
        selectedCount={selectedAccounts.size}
        value={bulkImportConfig}
        loading={bulkImportLoading}
        t={t}
        onClose={() => setShowBulkImport(false)}
        onChange={setBulkImportConfig}
        onSubmit={handleBulkImportSubmit}
      />
      <LogsConsoleDialog
        open={showLogsDialog}
        accountName={logsAccountName}
        logs={accountLogs}
        loading={logsLoading}
        isZh={isZh}
        t={t}
        onClose={() => setShowLogsDialog(false)}
        onClearLogs={handleClearLogs}
      />
      </div>
  );
}
