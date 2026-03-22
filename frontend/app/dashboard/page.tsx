"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  getUpdateCheck,
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
  Info,
  ArrowSquareOut,
  RocketLaunch,
} from "@phosphor-icons/react";
import { ToastContainer, useToast } from "../../components/ui/toast";
import { ThemeLanguageToggle } from "../../components/ThemeLanguageToggle";
import { useLanguage } from "../../context/LanguageContext";
import AccountTasksContent from "./account-tasks/AccountTasksContent";
import { useDashboardOverview } from "@/features/accounts/hooks/use-dashboard-overview";
import { queryKeys } from "@/lib/query-keys";
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
const DASHBOARD_STATUS_CACHE_TS_KEY = "tg-pilot:dashboard-status-cache-ts";
const DASHBOARD_SELECTED_ACCOUNT_KEY = "tg-pilot:dashboard-selected-account";
const DASHBOARD_UPDATE_DISMISSED_KEY = "tg-pilot:update-banner-dismissed";
const DASHBOARD_UPDATE_REMIND_KEY = "tg-pilot:update-banner-remind";
const STATUS_CACHE_MAX_AGE_MS = 60_000;
const UPDATE_REMIND_DELAY_MS = 4 * 60 * 60 * 1000;

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
  const searchParams = useSearchParams();
  const { t, language } = useLanguage();
  const isZh = language === "zh";
  const { toasts, addToast, removeToast } = useToast();
  const queryClient = useQueryClient();
  const [token, setLocalToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAccountName, setSelectedAccountName] = useState<string | null>(null);
  const [taskCreateRequestKey, setTaskCreateRequestKey] = useState<string | null>(null);
  const [hideUpdateBanner, setHideUpdateBanner] = useState(false);

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
  const selectedAccountNameRef = useRef<string | null>(null);
  const statusCheckedRef = useRef(false);
  const statusCheckRequestIdRef = useRef(0);
  const accountStatusMapRef = useRef<Record<string, AccountStatusItem>>({});
  const dashboardOverview = useDashboardOverview(token);
  const updateCheckQuery = useQuery({
    queryKey: token ? queryKeys.updateCheck(token) : ["update-check", "anonymous"],
    queryFn: () => getUpdateCheck(token!),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const accounts = dashboardOverview.accounts;
  const taskCountMap = dashboardOverview.taskCountMap;
  const appVersion = dashboardOverview.appVersion;
  const dataLoaded = dashboardOverview.isFetched;
  const dashboardLoading = dashboardOverview.isLoading && accounts.length === 0;
  const refetchDashboardOverview = dashboardOverview.refetch;
  const queryString = searchParams.toString();
  const queryAccount = searchParams.get("account");
  const queryDialog = searchParams.get("dialog");

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
      const lastCheckedAt = Number(sessionStorage.getItem(DASHBOARD_STATUS_CACHE_TS_KEY) || "0");
      if (!lastCheckedAt || Date.now() - lastCheckedAt > STATUS_CACHE_MAX_AGE_MS) {
        return true;
      }
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

  const restoreSelectedAccount = useCallback(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(DASHBOARD_SELECTED_ACCOUNT_KEY);
    } catch {
      return null;
    }
  }, []);

  const updateDashboardRoute = useCallback(
    (nextAccountName?: string | null, options?: { dialog?: string | null }) => {
      const params = new URLSearchParams(queryString);
      if (nextAccountName) {
        params.set("account", nextAccountName);
      } else {
        params.delete("account");
      }

      if (options?.dialog) {
        params.set("dialog", options.dialog);
      } else {
        params.delete("dialog");
      }

      const query = params.toString();
      const nextUrl = query ? `/dashboard?${query}` : "/dashboard";
      if (queryString === query) {
        return;
      }
      router.replace(nextUrl, { scroll: false });
    },
    [queryString, router]
  );

  const mergeAccountStatuses = useCallback((
    previous: Record<string, AccountStatusItem>,
    incomingItems: AccountStatusItem[],
    accountNames: string[]
  ) => {
    const nextByName = new Map(incomingItems.map((item) => [item.account_name, item]));
    let changed = false;
    const merged: Record<string, AccountStatusItem> = { ...previous };

    for (const name of accountNames) {
      const previousItem = previous[name];
      const incoming = nextByName.get(name);

      if (!incoming) {
        if (!previousItem) {
          merged[name] = {
            account_name: name,
            ok: false,
            status: "unknown",
            message: "",
            needs_relogin: false,
          };
          changed = true;
        }
        continue;
      }

      const previousOnline =
        previousItem?.status === "valid" || previousItem?.status === "connected";
      const incomingTransient =
        incoming.status === "checking" ||
        (incoming.status === "error" && !incoming.needs_relogin);

      const resolved =
        previousOnline && incomingTransient
          ? {
              ...previousItem,
              checked_at: incoming.checked_at || previousItem.checked_at,
              code: incoming.code || previousItem.code,
            }
          : incoming;

      if (JSON.stringify(previousItem ?? null) !== JSON.stringify(resolved)) {
        merged[name] = resolved;
        changed = true;
      }
    }

    return changed ? merged : previous;
  }, []);

  const checkAccountStatusOnce = useCallback(async (tokenStr: string, accountList: AccountInfo[]) => {
    const accountNames = accountList.map((item) => item.name).filter(Boolean);
    if (accountNames.length === 0) {
      setAccountStatusMap({});
      return;
    }
    const requestId = statusCheckRequestIdRef.current + 1;
    statusCheckRequestIdRef.current = requestId;

    try {
      const response = await checkAccountsStatus(tokenStr, {
        account_names: accountNames,
        timeout_seconds: 10,
      });
      if (statusCheckRequestIdRef.current !== requestId) {
        return;
      }

      setAccountStatusMap((prev) =>
        mergeAccountStatuses(prev, response.results || [], accountNames)
      );
    } catch {
      // Keep previous statuses on transient failures to avoid perpetual "checking" loops.
    }
  }, [mergeAccountStatuses]);

  const loadData = useCallback(async () => {
    try {
      await refetchDashboardOverview();
      if (token) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.operationsOverview(token) });
      }
    } catch (err: any) {
      addToastRef.current(formatErrorMessage("load_failed", err), "error");
    }
  }, [formatErrorMessage, queryClient, refetchDashboardOverview, token]);

  useEffect(() => {
    const tokenStr = getToken();
    if (!tokenStr) {
      window.location.replace("/");
      return;
    }
    setLocalToken(tokenStr);
    restoreCachedStatus();
    setChecking(false);
    statusCheckedRef.current = false;
    void refetchDashboardOverview();
  }, [refetchDashboardOverview, restoreCachedStatus]);

  useEffect(() => {
    selectedAccountNameRef.current = selectedAccountName;
  }, [selectedAccountName]);

  useEffect(() => {
    accountStatusMapRef.current = accountStatusMap;
  }, [accountStatusMap]);

  useEffect(() => {
    if (!token || !dataLoaded || accounts.length === 0) {
      if (dataLoaded && accounts.length === 0) setAccountStatusMap({});
      return;
    }
    const currentStatusMap = accountStatusMapRef.current;
    const missingStatuses = accounts.some((account) => !currentStatusMap[account.name]);
    if (statusCheckedRef.current && !missingStatuses) return;

    if (shouldRunStatusCheck() || missingStatuses) {
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
      sessionStorage.setItem(DASHBOARD_STATUS_CACHE_TS_KEY, String(Date.now()));
    } catch {
      // ignore storage write errors
    }
  }, [accountStatusMap]);

  const getAccountTaskCount = (accountName: string) => {
    return taskCountMap.get(accountName) ?? 0;
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
    if (selectedAccountName === acc.name) {
      return;
    }
    setSelectedAccountName(acc.name);
  }, [accountStatusMap, openReloginDialog, selectedAccountName]);

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

  useEffect(() => {
    if (accounts.length === 0) {
      if (selectedAccountNameRef.current) {
        setSelectedAccountName(null);
      }
      return;
    }

    if (queryAccount && accounts.some((account) => account.name === queryAccount)) {
      if (selectedAccountNameRef.current !== queryAccount) {
        setSelectedAccountName(queryAccount);
      }
      return;
    }

    if (
      selectedAccountNameRef.current &&
      accounts.some((account) => account.name === selectedAccountNameRef.current)
    ) {
      return;
    }

    const restoredAccount = restoreSelectedAccount();
    if (restoredAccount && accounts.some((account) => account.name === restoredAccount)) {
      if (selectedAccountNameRef.current !== restoredAccount) {
        setSelectedAccountName(restoredAccount);
      }
      return;
    }

    const fallbackAccount = accounts[0]?.name || null;
    if (fallbackAccount && selectedAccountNameRef.current !== fallbackAccount) {
      setSelectedAccountName(fallbackAccount);
    } else if (!fallbackAccount && selectedAccountNameRef.current) {
      setSelectedAccountName(null);
    }
  }, [accounts, queryAccount, restoreSelectedAccount]);

  useEffect(() => {
    if (!selectedAccountName) return;
    if (queryAccount === selectedAccountName) return;
    updateDashboardRoute(selectedAccountName);
  }, [queryAccount, selectedAccountName, updateDashboardRoute]);

  useEffect(() => {
    if (!selectedAccountName || typeof window === "undefined") return;
    try {
      sessionStorage.setItem(DASHBOARD_SELECTED_ACCOUNT_KEY, selectedAccountName);
    } catch {
      // ignore storage write errors
    }
  }, [selectedAccountName]);

  useEffect(() => {
    if (queryDialog !== "create" || !selectedAccountName) {
      return;
    }
    setTaskCreateRequestKey(`${selectedAccountName}-${Date.now()}`);
    updateDashboardRoute(selectedAccountName, { dialog: null });
  }, [queryDialog, selectedAccountName, updateDashboardRoute]);

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

  const selectedAccount = accounts.find((a) => a.name === selectedAccountName);
  const selectedStatus = selectedAccountName ? accountStatusMap[selectedAccountName] : null;
  const updateInfo = updateCheckQuery.data;
  const updateBannerKey =
    updateInfo?.source_repo && updateInfo?.latest_version
      ? `${updateInfo.source_repo}:${updateInfo.latest_version}`
      : null;
  const showUpdateBanner =
    Boolean(updateInfo?.enabled) &&
    updateInfo?.status === "ok" &&
    Boolean(updateInfo?.has_update) &&
    Boolean(updateInfo?.latest_version) &&
    !hideUpdateBanner;

  useEffect(() => {
    if (typeof window === "undefined" || !updateBannerKey) {
      setHideUpdateBanner(false);
      return;
    }

    try {
      const dismissedKey = sessionStorage.getItem(DASHBOARD_UPDATE_DISMISSED_KEY);
      const remindRaw = sessionStorage.getItem(DASHBOARD_UPDATE_REMIND_KEY);
      let hidden = dismissedKey === updateBannerKey;

      if (remindRaw) {
        const remind = JSON.parse(remindRaw) as { key?: string; remindAt?: number };
        if (
          remind?.key === updateBannerKey &&
          typeof remind.remindAt === "number" &&
          remind.remindAt > Date.now()
        ) {
          hidden = true;
        } else if (remind?.key === updateBannerKey) {
          sessionStorage.removeItem(DASHBOARD_UPDATE_REMIND_KEY);
        }
      }

      setHideUpdateBanner(hidden);
    } catch {
      setHideUpdateBanner(false);
    }
  }, [updateBannerKey]);

  const dismissUpdateBannerForSession = useCallback(() => {
    if (!updateBannerKey || typeof window === "undefined") return;
    try {
      sessionStorage.setItem(DASHBOARD_UPDATE_DISMISSED_KEY, updateBannerKey);
      sessionStorage.removeItem(DASHBOARD_UPDATE_REMIND_KEY);
    } catch {
      // ignore storage errors
    }
    setHideUpdateBanner(true);
  }, [updateBannerKey]);

  const remindUpdateBannerLater = useCallback(() => {
    if (!updateBannerKey || typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        DASHBOARD_UPDATE_REMIND_KEY,
        JSON.stringify({
          key: updateBannerKey,
          remindAt: Date.now() + UPDATE_REMIND_DELAY_MS,
        })
      );
      sessionStorage.removeItem(DASHBOARD_UPDATE_DISMISSED_KEY);
    } catch {
      // ignore storage errors
    }
    setHideUpdateBanner(true);
  }, [updateBannerKey]);

  if (!mounted || checking || (token && dashboardLoading && !dataLoaded)) {
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
          {showUpdateBanner ? (
            <div className="mb-8 rounded-[28px] border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(255,255,255,0.03),rgba(14,14,14,0.94))] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                    <RocketLaunch weight="bold" size={22} />
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300/70">
                      {isZh ? "版本更新提醒" : "Update Available"}
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {isZh
                        ? `发现新版本 ${updateInfo?.latest_version}，当前部署为 v${appVersion}`
                        : `New version ${updateInfo?.latest_version} is available. Current deployment: v${appVersion}`}
                    </div>
                    <p className="max-w-2xl text-sm leading-relaxed text-white/55">
                      {isZh
                        ? `当前默认跟踪上游 ${updateInfo?.source_repo} 的正式发布版本。fork 后部署的实例也能在这里看到你的上游更新。`
                        : `This instance is tracking stable releases from ${updateInfo?.source_repo}. Fork deployments can keep following your upstream updates here.`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <div className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">
                    {isZh ? "当前版本" : "Current"}: v{appVersion}
                  </div>
                  <div className="rounded-full border border-emerald-400/15 bg-emerald-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200">
                    {isZh ? "最新版本" : "Latest"}: {updateInfo?.latest_version}
                  </div>
                  <button
                    type="button"
                    onClick={remindUpdateBannerLater}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-black/20 px-5 text-[11px] font-black uppercase tracking-[0.18em] text-white/55 transition-all hover:border-white/15 hover:bg-white/[0.05] hover:text-white"
                  >
                    {isZh ? "稍后提醒" : "Remind Later"}
                  </button>
                  <button
                    type="button"
                    onClick={dismissUpdateBannerForSession}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-black/20 px-5 text-[11px] font-black uppercase tracking-[0.18em] text-white/55 transition-all hover:border-white/15 hover:bg-white/[0.05] hover:text-white"
                  >
                    <X weight="bold" size={14} />
                    {isZh ? "本次会话关闭" : "Dismiss This Session"}
                  </button>
                  <a
                    href={updateInfo?.release_url || `https://github.com/${updateInfo?.source_repo}/releases`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-5 text-[11px] font-black uppercase tracking-[0.22em] text-white/80 transition-all hover:border-emerald-400/20 hover:bg-white/[0.08] hover:text-white"
                  >
                    <ArrowSquareOut weight="bold" size={16} />
                    {isZh ? "查看发布说明" : "View Release"}
                  </a>
                </div>
              </div>
            </div>
          ) : null}

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
              <AccountTasksContent
                embedded={true}
                initialAccountName={selectedAccount.name}
                createRequestKey={taskCreateRequestKey}
                addToastOverride={addToast}
              />
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
