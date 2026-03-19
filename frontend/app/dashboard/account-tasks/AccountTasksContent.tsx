"use client";

import { useEffect, useState, memo, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getToken } from "../../../lib/auth";
import {
    deleteSignTask,
    runSignTask,
    getSignTaskHistory,
    searchAccountChats,
    createSignTask,
    updateSignTask,
    exportSignTask,
    importSignTask,
    SignTask,
    SignTaskHistoryItem,
    ChatInfo,
    CreateSignTaskRequest,
} from "../../../lib/api";
import {
    CaretLeft,
    Plus,
    Play,
    PencilSimple,
    Trash,
    Spinner,
    Clock,
    ChatCircleText,
    CheckCircle,
    XCircle,
    Hourglass,
    ArrowClockwise,
    ListDashes,
    X,
    CaretDown,
    DotsThreeVertical,
    Robot,
    MathOperations,
    Lightning,
    Copy,
    ClipboardText,
    Files,
    Info,
    CirclesThree,
    MagnifyingGlass,
    UsersThree,
    Hash,
    Timer,
    Warning
} from "@phosphor-icons/react";
import { ToastContainer, useToast } from "../../../components/ui/toast";
import { useLanguage } from "../../../context/LanguageContext";
import { useAccountTaskData } from "@/features/sign-tasks/hooks/use-account-task-data";
import { SignTaskDialogs } from "@/features/sign-tasks/components/sign-task-dialogs";
import { TaskEditorDialog } from "@/features/sign-tasks/components/task-editor-dialog";
import { EmptyState } from "@/components/ui/empty-state";

type ActionTypeOption = "1" | "2" | "3" | "ai_vision" | "ai_logic";

const DICE_OPTIONS = [
    "\uD83C\uDFB2",
    "\uD83C\uDFAF",
    "\uD83C\uDFC0",
    "\u26BD",
    "\uD83C\uDFB3",
    "\uD83C\uDFB0",
] as const;

// Memoized Task Item Component
const TaskItem = memo(({ task, loading, isRunning, onEdit, onRun, onViewLogs, onCopy, onDelete, t, language }: {
    task: SignTask;
    loading: boolean;
    isRunning: boolean;
    onEdit: (task: SignTask) => void;
    onRun: (name: string) => void;
    onViewLogs: (task: SignTask) => void;
    onCopy: (name: string) => void;
    onDelete: (name: string) => void;
    t: (key: string) => string;
    language: string;
}) => {
    const copyTaskTitle = language === "zh" ? "\u590D\u5236\u4EFB\u52A1" : "Copy Task";

    return (
        <div className={`glass-panel p-4 md:p-5 group transition-all duration-300 ${isRunning ? 'ring-2 ring-emerald-500/20 border-emerald-500/30 animate-pulse-subtle' : 'hover:border-[var(--accent-glow)]/30'}`}>
            <div className="flex items-start gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent-glow)]/10 flex items-center justify-center text-[#b57dff] shrink-0">
                    <ChatCircleText weight="bold" size={20} />
                </div>
                <div className="min-w-0 flex-1 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold truncate text-sm" title={task.name}>{task.name}</h3>
                        <span className="text-[9px] font-mono text-main/30 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                            {task.chats[0]?.chat_id || "-"}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-main/40">
                            <Clock weight="bold" size={12} />
                            <span className="text-[10px] font-bold font-mono uppercase tracking-wider">
                                {task.execution_mode === "range" && task.range_start && task.range_end
                                    ? `${task.range_start} - ${task.range_end}`
                                    : task.sign_at}
                            </span>
                        </div>
                        {task.random_seconds > 0 && (
                            <div className="flex items-center gap-1 text-[var(--accent-glow)]/60">
                                <Hourglass weight="bold" size={12} />
                                <span className="text-[10px] font-bold">~{Math.round(task.random_seconds / 60)}m</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="hidden md:flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onRun(task.name)}
                        disabled={loading || isRunning}
                        className={`action-btn !w-8 !h-8 ${isRunning ? 'text-main/20' : '!text-emerald-400 hover:bg-emerald-500/10'}`}
                        title={t("run")}
                    >
                        {isRunning ? <Spinner weight="bold" size={14} className="animate-spin" /> : <Play weight="fill" size={14} />}
                    </button>
                    <button
                        onClick={() => onEdit(task)}
                        disabled={loading}
                        className="action-btn !w-8 !h-8 hover:text-white"
                        title={t("edit")}
                    >
                        <PencilSimple weight="bold" size={14} />
                    </button>
                    <button
                        onClick={() => onViewLogs(task)}
                        disabled={loading}
                        className="action-btn !w-8 !h-8 !text-[var(--accent-glow)] hover:bg-[var(--accent-glow)]/10"
                        title={t("task_history_logs")}
                    >
                        <ListDashes weight="bold" size={14} />
                    </button>
                    <button
                        onClick={() => onCopy(task.name)}
                        disabled={loading}
                        className="action-btn !w-8 !h-8 !text-sky-400 hover:bg-sky-500/10"
                        title={copyTaskTitle}
                    >
                        <Copy weight="bold" size={14} />
                    </button>
                    <button
                        onClick={() => onDelete(task.name)}
                        disabled={loading}
                        className="action-btn !w-8 !h-8 !text-rose-400 hover:bg-rose-500/10"
                        title={t("delete")}
                    >
                        <Trash weight="bold" size={14} />
                    </button>
                </div>
            </div>

            <div className="mt-3 md:mt-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-white/5 pt-3">
                <div className="flex items-center gap-4">
                    {task.last_run ? (
                        <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${task.last_run.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {task.last_run.success ? <CheckCircle weight="bold" /> : <XCircle weight="bold" />}
                            <span className="text-main/60 font-mono normal-case tracking-normal">
                                {new Date(task.last_run.time).toLocaleString(language === "zh" ? 'zh-CN' : 'en-US', {
                                    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                                })}
                            </span>
                        </div>
                    ) : (
                        <div className="text-[10px] text-main/20 font-bold uppercase tracking-widest italic">{t("no_data")}</div>
                    )}
                </div>
                
                <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--accent-glow)]/60">
                    <CirclesThree weight="fill" /> 
                    {t("contains_actions").replace("{count}", String(task.chats[0]?.actions?.length || 0))}
                </div>
            </div>

            <div className="mt-3 grid grid-cols-5 gap-2 md:hidden">
                <button
                    onClick={() => onRun(task.name)}
                    disabled={loading}
                    className="action-btn !w-full !h-10 !text-emerald-400 hover:bg-emerald-500/10"
                    title={t("run")}
                >
                    <Play weight="fill" size={14} />
                </button>
                <button
                    onClick={() => onEdit(task)}
                    disabled={loading}
                    className="action-btn !w-full !h-10"
                    title={t("edit")}
                >
                    <PencilSimple weight="bold" size={14} />
                </button>
                <button
                    onClick={() => onViewLogs(task)}
                    disabled={loading}
                    className="action-btn !w-full !h-10 !text-[var(--accent-glow)] hover:bg-[var(--accent-glow)]/10"
                    title={t("task_history_logs")}
                >
                    <ListDashes weight="bold" size={14} />
                </button>
                <button
                    onClick={() => onCopy(task.name)}
                    disabled={loading}
                    className="action-btn !w-full !h-10 !text-sky-400 hover:bg-sky-500/10"
                    title={copyTaskTitle}
                >
                    <Copy weight="bold" size={14} />
                </button>
                <button
                    onClick={() => onDelete(task.name)}
                    disabled={loading}
                    className="action-btn !w-full !h-10 !text-rose-400 hover:bg-rose-500/10"
                    title={t("delete")}
                >
                    <Trash weight="bold" size={14} />
                </button>
            </div>
        </div>
    );
});

TaskItem.displayName = "TaskItem";

export default function AccountTasksContent({ 
    embedded = false, 
    initialAccountName = "",
    autoOpenCreate = false,
}: { 
    embedded?: boolean; 
    initialAccountName?: string;
    autoOpenCreate?: boolean;
}) {
    const router = useRouter();
    const { t, language } = useLanguage();
    const isZh = language === "zh";
    const searchParams = useSearchParams();
    const accountNameFromUrl = searchParams.get("name") || "";
    const accountName = initialAccountName || accountNameFromUrl;
    const { toasts, addToast, removeToast } = useToast();
    const fieldLabelClass = "text-xs font-bold uppercase tracking-wider text-main/40 mb-1 block";

    const [token, setLocalToken] = useState<string | null>(null);
    const [chatSearch, setChatSearch] = useState("");
    const [chatSearchResults, setChatSearchResults] = useState<ChatInfo[]>([]);
    const [chatSearchLoading, setChatSearchLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [refreshingChats, setRefreshingChats] = useState(false);
    const [historyTaskName, setHistoryTaskName] = useState<string | null>(null);
    const [historyLogs, setHistoryLogs] = useState<SignTaskHistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());
    const [showFailedOnly, setShowFailedOnly] = useState(false);
    const [showDeleteTaskDialog, setShowDeleteTaskDialog] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

    const addToastRef = useRef(addToast);
    const tRef = useRef(t);
    useEffect(() => {
        addToastRef.current = addToast;
        tRef.current = t;
    }, [addToast, t]);

    const formatErrorMessage = useCallback((key: string, err?: any) => {
        const base = tRef.current ? tRef.current(key) : key;
        const code = err?.code;
        return code ? `${base} (${code})` : base;
    }, []);
    const handleAccountSessionInvalid = useCallback((err: any) => {
        if (err?.code !== "ACCOUNT_SESSION_INVALID") return false;
        const toast = addToastRef.current;
        const message = tRef.current
            ? tRef.current("account_session_invalid")
            : "Account session expired, please login again";
        if (toast) {
            toast(message, "error");
        }
        setTimeout(() => {
            router.replace("/dashboard");
        }, 800);
        return true;
    }, [router]);

    // 任务弹窗状态控制
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newTask, setNewTask] = useState({
        name: "",
        sign_at: "0 6 * * *",
        random_minutes: 0,
        chat_id: 0,
        chat_id_manual: "",
        chat_name: "",
        actions: [{ action: 1, text: "" }],
        delete_after: undefined as number | undefined,
        action_interval: 10,
        execution_mode: "range" as "fixed" | "range",
        range_start: "09:00",
        range_end: "18:00",
    });

    // 缂傚倸鍊搁崐鎼佸磹瑜版帗鍋嬮柣鎰仛椤愯姤銇勯幇鍓佹偧妞も晝鍏橀幃褰掑炊閵娿儳绁峰銈庡亖閸婃繈骞冨Δ鍛仺婵炲牊瀵ч弫顖炴⒑娴兼瑧鐣虫俊顐㈠閵?
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editingTaskName, setEditingTaskName] = useState("");
    const [editTask, setEditTask] = useState({
        sign_at: "0 6 * * *",
        random_minutes: 0,
        chat_id: 0,
        chat_id_manual: "",
        chat_name: "",
        actions: [{ action: 1, text: "" }] as any[],
        delete_after: undefined as number | undefined,
        action_interval: 10,
        execution_mode: "fixed" as "fixed" | "range",
        range_start: "09:00",
        range_end: "18:00",
    });
    const [copyTaskDialog, setCopyTaskDialog] = useState<{ taskName: string; config: string } | null>(null);
    const [showPasteDialog, setShowPasteDialog] = useState(false);
    const [pasteTaskConfigInput, setPasteTaskConfigInput] = useState("");
    const [copyingConfig, setCopyingConfig] = useState(false);
    const [importingPastedConfig, setImportingPastedConfig] = useState(false);

    const [checking, setChecking] = useState(true);
    const accountTaskData = useAccountTaskData(token, accountName);
    const tasks = accountTaskData.tasks;
    const chats = accountTaskData.chats;
    const initialLoading = accountTaskData.isLoading;
    const refetchTaskData = accountTaskData.refetchAll;
    const refreshTaskChats = accountTaskData.refreshChats;
    const taskNamePlaceholder = isZh ? "\u7559\u7A7A\u4F7F\u7528\u9ED8\u8BA4\u540D\u79F0" : "Leave empty to use default name";
    const sendTextLabel = isZh ? "\u53D1\u9001\u6587\u672C\u6D88\u606F" : "Send Text Message";
    const clickTextButtonLabel = isZh ? "\u70B9\u51FB\u6587\u5B57\u6309\u94AE" : "Click Text Button";
    const sendDiceLabel = isZh ? "\u53D1\u9001\u9AB0\u5B50" : "Send Dice";
    const aiVisionLabel = isZh ? "AI\u8BC6\u56FE" : "AI Vision";
    const aiCalcLabel = isZh ? "AI\u8BA1\u7B97" : "AI Calculate";
    const sendTextPlaceholder = isZh ? "\u53D1\u9001\u7684\u6587\u672C\u5185\u5BB9" : "Text to send";
    const clickButtonPlaceholder = isZh ? "\u8F93\u5165\u6309\u94AE\u6587\u5B57\uFF0C\u4E0D\u8981\u8868\u60C5\uFF01" : "Button text to click, no emoji";
    const aiVisionSendModeLabel = isZh ? "\u8BC6\u56FE\u540E\u53D1\u6587\u672C" : "Vision -> Send Text";
    const aiVisionClickModeLabel = isZh ? "\u8BC6\u56FE\u540E\u70B9\u6309\u94AE" : "Vision -> Click Button";
    const aiCalcSendModeLabel = isZh ? "\u8BA1\u7B97\u540E\u53D1\u6587\u672C" : "Math -> Send Text";
    const aiCalcClickModeLabel = isZh ? "\u8BA1\u7B97\u540E\u70B9\u6309\u94AE" : "Math -> Click Button";
    const pasteTaskTitle = isZh ? "\u7C98\u8D34\u5BFC\u5165\u4EFB\u52A1" : "Paste Task";
    const copyTaskDialogTitle = isZh ? "\u590D\u5236\u4EFB\u52A1\u914D\u7F6E" : "Copy Task Config";
    const copyTaskDialogDesc = isZh ? "\u4EE5\u4E0B\u662F\u4EFB\u52A1\u914D\u7F6E\uFF0C\u53EF\u624B\u52A8\u590D\u5236\u6216\u70B9\u51FB\u4E00\u952E\u590D\u5236\u3002" : "Task config is ready. Copy manually or use one-click copy.";
    const copyConfigAction = isZh ? "\u4E00\u952E\u590D\u5236" : "Copy";
    const pasteTaskDialogTitle = isZh ? "\u7C98\u8D34\u5BFC\u5165\u4EFB\u52A1" : "Paste Task Config";
    const pasteTaskDialogDesc = isZh ? "\u65E0\u6CD5\u76F4\u63A5\u8BFB\u53D6\u526A\u8D34\u677F\uFF0C\u8BF7\u5728\u4E0B\u65B9\u7C98\u8D34\u914D\u7F6E\u540E\u5BFC\u5165\u3002" : "Clipboard read failed. Paste config below and import.";
    const pasteTaskDialogPlaceholder = isZh ? "\u5728\u6B64\u7C98\u8D34\u4EFB\u52A1\u914D\u7F6E JSON..." : "Paste task config JSON here...";
    const importTaskAction = isZh ? "\u5BFC\u5165\u4EFB\u52A1" : "Import Task";
    const clipboardReadFailed = isZh ? "\u65E0\u6CD5\u8BFB\u53D6\u526A\u8D34\u677F\uFF0C\u5DF2\u5207\u6362\u4E3A\u624B\u52A8\u7C98\u8D34\u5BFC\u5165" : "Clipboard read failed, switched to manual paste import";
    const copyTaskSuccess = (taskName: string) =>
        isZh ? `\u4EFB\u52A1 ${taskName} \u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F` : `Task ${taskName} copied to clipboard`;
    const copyTaskFailed = isZh ? "\u590D\u5236\u4EFB\u52A1\u5931\u8D25" : "Copy task failed";
    const pasteTaskSuccess = (taskName: string) =>
        isZh ? `\u4EFB\u52A1 ${taskName} \u5BFC\u5165\u6210\u529F` : `Task ${taskName} imported`;
    const pasteTaskFailed = isZh ? "\u7C98\u8D34\u4EFB\u52A1\u5931\u8D25" : "Paste task failed";
    const clipboardUnsupported = isZh ? "\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u526A\u8D34\u677F\u64CD\u4F5C" : "Clipboard API is not available";
    const copyTaskFallbackManual = isZh ? "\u81EA\u52A8\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u5728\u5F39\u7A97\u5185\u624B\u52A8\u590D\u5236" : "Auto copy failed, please copy manually from dialog";

    const sanitizeTaskName = useCallback((raw: string) => {
        return raw
            .trim()
            .replace(/[<>:"/\\|?*]+/g, "_")
            .replace(/\s+/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 64);
    }, []);

    const toActionTypeOption = useCallback((action: any): ActionTypeOption => {
        const actionId = Number(action?.action);
        if (actionId === 1) return "1";
        if (actionId === 3) return "3";
        if (actionId === 2) return "2";
        if (actionId === 4 || actionId === 6) return "ai_vision";
        if (actionId === 5 || actionId === 7) return "ai_logic";
        return "1";
    }, []);

    const isActionValid = useCallback((action: any) => {
        const actionId = Number(action?.action);
        if (actionId === 1 || actionId === 3) {
            return Boolean((action?.text || "").trim());
        }
        if (actionId === 2) {
            return Boolean((action?.dice || "").trim());
        }
        return [4, 5, 6, 7].includes(actionId);
    }, []);

    const loadData = useCallback(async () => {
        try {
            await refetchTaskData();
        } catch (err: any) {
            if (handleAccountSessionInvalid(err)) return;
            const toast = addToastRef.current;
            if (toast) {
                toast(formatErrorMessage("load_failed", err), "error");
            }
        }
    }, [formatErrorMessage, handleAccountSessionInvalid, refetchTaskData]);

    useEffect(() => {
        const tokenStr = getToken();
        if (!tokenStr) {
            window.location.replace("/");
            return;
        }
        if (!accountName) {
            setChecking(false);
            return;
        }
        setLocalToken(tokenStr);
        setChecking(false);
        void refetchTaskData();
    }, [accountName, embedded, refetchTaskData]);

    useEffect(() => {
        if (!token || !accountName) return;
        const query = chatSearch.trim();
        if (!query) {
            setChatSearchResults([]);
            setChatSearchLoading(false);
            return;
        }
        let cancelled = false;
        setChatSearchLoading(true);
        const timer = setTimeout(async () => {
            try {
                const res = await searchAccountChats(token, accountName, query, 50, 0);
                if (!cancelled) {
                    setChatSearchResults(res.items || []);
                }
            } catch (err: any) {
                if (!cancelled) {
                    if (handleAccountSessionInvalid(err)) return;
                    const toast = addToastRef.current;
                    if (toast) {
                        toast(formatErrorMessage("search_failed", err), "error");
                    }
                    setChatSearchResults([]);
                }
            } finally {
                if (!cancelled) {
                    setChatSearchLoading(false);
                }
            }
        }, 300);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [chatSearch, token, accountName, formatErrorMessage, handleAccountSessionInvalid]);

    useEffect(() => {
        if (!showCreateDialog && !showEditDialog) {
            setChatSearch("");
            setChatSearchResults([]);
            setChatSearchLoading(false);
        }
    }, [showCreateDialog, showEditDialog, accountName]);

    useEffect(() => {
        if (!autoOpenCreate) return;
        if (!accountName || !token) return;
        if (showCreateDialog || showEditDialog) return;
        setShowCreateDialog(true);
    }, [accountName, autoOpenCreate, showCreateDialog, showEditDialog, token]);

    const handleRefreshChats = async () => {
        if (!token || !accountName) return;
        try {
            setRefreshingChats(true);
            await refreshTaskChats(true);
            addToast(t("chats_refreshed"), "success");
        } catch (err: any) {
            if (handleAccountSessionInvalid(err)) return;
            addToast(formatErrorMessage("refresh_failed", err), "error");
        } finally {
            setRefreshingChats(false);
        }
    };

    const refreshChats = async () => {
        if (!token) return;
        try {
            setLoading(true);
            await refreshTaskChats(false);
            addToast(t("chats_refreshed"), "success");
        } catch (err: any) {
            if (handleAccountSessionInvalid(err)) return;
            addToast(formatErrorMessage("refresh_failed", err), "error");
        } finally {
            setLoading(false);
        }
    };

    const applyChatSelection = (chatId: number, chatName: string) => {
        if (showCreateDialog) {
            setNewTask({
                ...newTask,
                name: newTask.name || chatName,
                chat_id: chatId,
                chat_id_manual: chatId !== 0 ? chatId.toString() : "",
                chat_name: chatName,
            });
        } else {
            setEditTask({
                ...editTask,
                chat_id: chatId,
                chat_id_manual: chatId !== 0 ? chatId.toString() : "",
                chat_name: chatName,
            });
        }
    };

    const handleDeleteTask = (taskName: string) => {
        setTaskToDelete(taskName);
        setShowDeleteTaskDialog(true);
    };

    const confirmDeleteTask = async () => {
        if (!token || !taskToDelete) return;
        try {
            setLoading(true);
            await deleteSignTask(token, taskToDelete, accountName);
            setShowDeleteTaskDialog(false);
            setTaskToDelete(null);
            await loadData();
        } catch (err: any) {
            // Only show error if it's NOT a 404 (already deleted/doesn't exist)
            if (err.status !== 404 && !err.message?.includes("not exist")) {
                addToast(formatErrorMessage("delete_failed", err), "error");
            } else {
                setShowDeleteTaskDialog(false);
                setTaskToDelete(null);
                await loadData(); // Refresh anyway if it doesn't exist
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRunTask = async (taskName: string) => {
        if (!token) return;
        setRunningTasks(prev => new Set(prev).add(taskName));

        try {
            const result = await runSignTask(token, taskName, accountName);

            if (result.success) {
                addToast(t("task_run_success").replace("{name}", taskName), "success");
            } else {
                addToast(t("task_run_failed"), "error");
            }
        } catch (err: any) {
            addToast(formatErrorMessage("task_run_failed", err), "error");
        } finally {
            setRunningTasks(prev => {
                const next = new Set(prev);
                next.delete(taskName);
                return next;
            });
        }
    };

    const handleShowTaskHistory = async (task: SignTask) => {
        if (!token) return;
        setHistoryTaskName(task.name);
        setHistoryLogs([]);
        setHistoryLoading(true);
        try {
            const logs = await getSignTaskHistory(token, task.name, accountName, 30);
            setHistoryLogs(logs);
        } catch (err: any) {
            addToast(formatErrorMessage("logs_fetch_failed", err), "error");
        } finally {
            setHistoryLoading(false);
        }
    };

    const importTaskFromConfig = async (rawConfig: string): Promise<{ ok: boolean; error?: string }> => {
        if (!token) return { ok: false, error: "NO_TOKEN" };
        const taskConfig = (rawConfig || "").trim();
        if (!taskConfig) {
            addToast(t("import_empty"), "error");
            return { ok: false, error: t("import_empty") };
        }

        try {
            setLoading(true);
            const result = await importSignTask(token, taskConfig, undefined, accountName);
            addToast(pasteTaskSuccess(result.task_name), "success");
            await loadData();
            return { ok: true };
        } catch (err: any) {
            const message = err?.message ? `${pasteTaskFailed}: ${err.message}` : pasteTaskFailed;
            addToast(message, "error");
            return { ok: false, error: message };
        } finally {
            setLoading(false);
        }
    };

    const handleCopyTask = async (taskName: string) => {
        if (!token) return;

        try {
            setLoading(true);
            const taskConfig = await exportSignTask(token, taskName, accountName);
            if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                try {
                    await navigator.clipboard.writeText(taskConfig);
                    addToast(copyTaskSuccess(taskName), "success");
                    return;
                } catch {
                    addToast(copyTaskFallbackManual, "error");
                }
            }
            setCopyTaskDialog({ taskName, config: taskConfig });
        } catch (err: any) {
            const message = err?.message ? `${copyTaskFailed}: ${err.message}` : copyTaskFailed;
            addToast(message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleCopyTaskConfig = async () => {
        if (!copyTaskDialog) return;
        
        const text = copyTaskDialog.config;
        let success = false;

        // 优先使用现代化 Clipboard API
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                success = true;
            } catch (err) {
                console.warn("Navigator clipboard failed, trying fallback:", err);
            }
        }

        // 备选方案: document.execCommand('copy')
        if (!success) {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                // 防止页面滚动
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                success = document.execCommand("copy");
                document.body.removeChild(textArea);
            } catch (err) {
                console.error("Fallback copy failed:", err);
            }
        }

        if (success) {
            addToast(copyTaskSuccess(copyTaskDialog.taskName), "success");
            setCopyTaskDialog(null);
        } else {
            addToast(clipboardUnsupported, "error");
        }
    };

    const handlePasteDialogImport = async () => {
        setImportingPastedConfig(true);
        const result = await importTaskFromConfig(pasteTaskConfigInput);
        if (result.ok) {
            setShowPasteDialog(false);
            setPasteTaskConfigInput("");
        }
        setImportingPastedConfig(false);
    };

    const handlePasteTask = async () => {
        if (!token) return;

        if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
            try {
                const taskConfig = (await navigator.clipboard.readText()).trim();
                if (taskConfig) {
                    const result = await importTaskFromConfig(taskConfig);
                    if (result.ok) {
                        return;
                    }
                    setPasteTaskConfigInput(taskConfig);
                    setShowPasteDialog(true);
                    return;
                }
            } catch {
                addToast(clipboardReadFailed, "error");
            }
        } else {
            addToast(clipboardUnsupported, "error");
        }

        setPasteTaskConfigInput("");
        setShowPasteDialog(true);
    };

    const closeCopyTaskDialog = () => {
        if (copyingConfig) {
            return;
        }
        setCopyTaskDialog(null);
    };

    const closePasteTaskDialog = () => {
        if (importingPastedConfig || loading) {
            return;
        }
        setShowPasteDialog(false);
        setPasteTaskConfigInput("");
    };

    const handleCreateTask = async () => {
        if (!token) return;

        if (!newTask.sign_at) {
            addToast(t("cron_required"), "error");
            return;
        }

        let chatId = newTask.chat_id;
        if (newTask.chat_id_manual) {
            chatId = parseInt(newTask.chat_id_manual);
            if (isNaN(chatId)) {
                addToast(t("chat_id_numeric"), "error");
                return;
            }
        }

        if (chatId === 0) {
            addToast(t("select_chat_error"), "error");
            return;
        }

        if (newTask.actions.length === 0 || newTask.actions.some((action) => !isActionValid(action))) {
            addToast(t("add_action_error"), "error");
            return;
        }

        try {
            setLoading(true);
            const fallbackTaskName =
                sanitizeTaskName(newTask.chat_name) ||
                sanitizeTaskName(newTask.chat_id_manual ? `chat_${newTask.chat_id_manual}` : "") ||
                `task_${Date.now()}`;
            const finalTaskName = sanitizeTaskName(newTask.name) || fallbackTaskName;

            const request: CreateSignTaskRequest = {
                name: finalTaskName,
                account_name: accountName,
                sign_at: newTask.sign_at,
                chats: [{
                    chat_id: chatId,
                    name: newTask.chat_name || t("chat_default_name").replace("{id}", String(chatId)),
                    actions: newTask.actions,
                    delete_after: newTask.delete_after,
                    action_interval: newTask.action_interval,
                }],
                random_seconds: newTask.random_minutes * 60,
                execution_mode: newTask.execution_mode,
                range_start: newTask.range_start,
                range_end: newTask.range_end,
            };

            await createSignTask(token, request);
            addToast(t("create_success"), "success");
            setShowCreateDialog(false);
            setNewTask({
                name: "",
                sign_at: "0 6 * * *",
                random_minutes: 0,
                chat_id: 0,
                chat_id_manual: "",
                chat_name: "",
                actions: [{ action: 1, text: "" }],
                delete_after: undefined,
                action_interval: 10,
                execution_mode: "fixed",
                range_start: "09:00",
                range_end: "18:00",
            });
            await loadData();
        } catch (err: any) {
            addToast(formatErrorMessage("create_failed", err), "error");
        } finally {
            setLoading(false);
        }
    };

    const handleAddAction = () => {
        setNewTask({
            ...newTask,
            actions: [...newTask.actions, { action: 1, text: "" }],
        });
    };

    const handleRemoveAction = (index: number) => {
        setNewTask({
            ...newTask,
            actions: newTask.actions.filter((_, i) => i !== index),
        });
    };

    const handleEditTask = (task: SignTask) => {
        setEditingTaskName(task.name);
        const chat = task.chats[0];
        setEditTask({
            sign_at: task.sign_at,
            random_minutes: Math.round(task.random_seconds / 60),
            chat_id: chat?.chat_id || 0,
            chat_id_manual: chat?.chat_id?.toString() || "",
            chat_name: chat?.name || "",
            actions: chat?.actions || [{ action: 1, text: "" }],
            delete_after: chat?.delete_after,
            action_interval: chat?.action_interval || 1,
            execution_mode: task.execution_mode || "fixed",
            range_start: task.range_start || "09:00",
            range_end: task.range_end || "18:00",
        });
        setShowEditDialog(true);
    };

    const handleSaveEdit = async () => {
        if (!token) return;

        const chatId = editTask.chat_id || parseInt(editTask.chat_id_manual) || 0;
        if (!chatId) {
            addToast(t("select_chat_error"), "error");
            return;
        }
        if (editTask.actions.length === 0 || editTask.actions.some((action) => !isActionValid(action))) {
            addToast(t("add_action_error"), "error");
            return;
        }

        try {
            setLoading(true);

            await updateSignTask(token, editingTaskName, {
                sign_at: editTask.sign_at,
                random_seconds: editTask.random_minutes * 60,
                chats: [{
                    chat_id: chatId,
                    name: editTask.chat_name || t("chat_default_name").replace("{id}", String(chatId)),
                    actions: editTask.actions,
                    delete_after: editTask.delete_after,
                    action_interval: editTask.action_interval,
                }],
                execution_mode: editTask.execution_mode,
                range_start: editTask.range_start,
                range_end: editTask.range_end,
            }, accountName);

            addToast(t("update_success"), "success");
            setShowEditDialog(false);
            await loadData();
        } catch (err: any) {
            addToast(formatErrorMessage("update_failed", err), "error");
        } finally {
            setLoading(false);
        }
    };

    const handleEditAddAction = () => {
        setEditTask({
            ...editTask,
            actions: [...editTask.actions, { action: 1, text: "" }],
        });
    };

    const handleEditRemoveAction = (index: number) => {
        if (editTask.actions.length <= 1) return;
        setEditTask({
            ...editTask,
            actions: editTask.actions.filter((_, i) => i !== index),
        });
    };

    const updateCurrentDialogAction = useCallback((index: number, updater: (action: any) => any) => {
        if (showCreateDialog) {
            setNewTask((prev) => {
                if (index < 0 || index >= prev.actions.length) return prev;
                const nextActions = [...prev.actions];
                nextActions[index] = updater(nextActions[index] || { action: 1, text: "" });
                return { ...prev, actions: nextActions };
            });
            return;
        }

        setEditTask((prev) => {
            if (index < 0 || index >= prev.actions.length) return prev;
            const nextActions = [...prev.actions];
            nextActions[index] = updater(nextActions[index] || { action: 1, text: "" });
            return { ...prev, actions: nextActions };
        });
    }, [showCreateDialog]);

    if (checking) {
        return null;
    }

    if (!accountName && !embedded) {
        return (
            <div id="account-tasks-view" className="w-full h-full flex flex-col">
                <nav className="navbar">
                    <div className="nav-brand">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="action-btn !w-8 !h-8" title={t("sidebar_home")}>
                                <CaretLeft weight="bold" size={18} />
                            </Link>
                            <h1 className="text-lg font-bold tracking-tight">{isZh ? "任务列表" : "Task Board"}</h1>
                        </div>
                    </div>
                </nav>
                <main className="main-content !pt-6">
                    <EmptyState
                        icon={<Lightning size={40} weight="bold" />}
                        title={isZh ? "先选择一个账号" : "Choose an account first"}
                        description={isZh ? "签到任务依然以账号为单位管理。请先从仪表盘选择账号，再进入任务工作台。" : "Sign tasks are still managed per account. Pick an account from the dashboard first, then open the task workspace."}
                        action={
                            <Link href="/dashboard" className="linear-btn-secondary">
                                <CaretLeft weight="bold" /> {t("sidebar_home")}
                            </Link>
                        }
                    />
                </main>
            </div>
        );
    }

    if (!token) {
        return null;
    }

    return (
        <div id="account-tasks-view" className={`w-full h-full flex flex-col ${embedded ? 'pt-2' : ''}`}>
            {!embedded && (
                <nav className="navbar">
                <div className="nav-brand">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="action-btn !w-8 !h-8" title={t("sidebar_home")}>
                            <CaretLeft weight="bold" size={18} />
                        </Link>
                        <h1 className="text-lg font-bold tracking-tight">{accountName}</h1>
                    </div>
                </div>
                <div className="top-right-actions">
                    <button
                        onClick={refreshChats}
                        disabled={loading}
                        className="action-btn !w-8 !h-8"
                        title={t("refresh_chats")}
                    >
                        <ArrowClockwise weight="bold" size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={handlePasteTask}
                        disabled={loading}
                        className="action-btn !w-8 !h-8 !text-sky-400 hover:bg-sky-500/10"
                        title={pasteTaskTitle}
                    >
                        <ClipboardText weight="bold" size={18} />
                    </button>
                    <button onClick={() => setShowCreateDialog(true)} className="action-btn !w-8 !h-8 !text-[var(--accent-glow)] hover:bg-[var(--accent-glow)]/10" title={t("add_task")}>
                        <Plus weight="bold" size={18} />
                    </button>
                </div>
                </nav>
            )}

            {embedded && (
                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3 shrink-0">
                    <h2 className="text-base font-bold flex items-center gap-2 text-[var(--text-main)]">
                        <Lightning weight="fill" className="text-[var(--accent-glow)]" /> 
                        {isZh ? "签到任务" : "Sign Tasks"} ({tasks.length})
                    </h2>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => loadData()}
                            className="p-2 text-[var(--text-sub)] hover:text-white hover:bg-white/5 rounded-md transition-all"
                            title={t("refresh_list")}
                        >
                            <ArrowClockwise weight="bold" className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={handlePasteTask}
                            disabled={loading}
                            className="p-2 text-sky-400 hover:bg-sky-500/10 rounded-md transition-all"
                            title={pasteTaskTitle}
                        >
                            <ClipboardText weight="bold" />
                        </button>
                        <button 
                            className="bg-[#EDEDED] text-[#0A0A0A] px-3.5 py-2 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5"
                            onClick={() => setShowCreateDialog(true)}
                        >
                            <Plus weight="bold" /> {t("add_task")}
                        </button>
                    </div>
                </div>
            )}

            <main className={`main-content ${embedded ? '!pt-0 !p-0' : '!pt-6'}`}>

                {initialLoading && tasks.length === 0 ? (
                    <div className="w-full py-20 flex flex-col items-center justify-center text-main/20">
                        <Spinner size={40} weight="bold" className="animate-spin mb-4" />
                        <p className="text-xs uppercase tracking-widest font-bold font-mono">{t("loading")}</p>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="glass-panel p-20 flex flex-col items-center text-center justify-center border-dashed border-2 group hover:border-[var(--accent-glow)]/30 transition-all cursor-pointer" onClick={() => setShowCreateDialog(true)}>
                        <div className="w-20 h-20 rounded-3xl bg-main/5 flex items-center justify-center text-main/20 mb-6 group-hover:scale-110 transition-transform group-hover:bg-[var(--accent-glow)]/10 group-hover:text-[var(--accent-glow)]">
                            <Plus size={40} weight="bold" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">{t("no_tasks")}</h3>
                        <p className="text-sm text-[#9496a1]">{t("no_tasks_desc")}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {tasks.map((task) => (
                            <TaskItem
                                key={task.name}
                                task={task}
                                loading={loading}
                                isRunning={runningTasks.has(task.name)}
                                onEdit={handleEditTask}
                                onRun={handleRunTask}
                                onViewLogs={handleShowTaskHistory}
                                onCopy={handleCopyTask}
                                onDelete={handleDeleteTask}
                                t={t}
                                language={language}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* 闂傚倷绀侀幉锛勬暜濡ゅ啰鐭欓柟瀵稿Х绾?缂傚倸鍊搁崐鎼佸磹瑜版帗鍋嬮柣鎰仛椤愯姤銇勯幇鈺佲偓鎰板磻閹剧粯鍋ㄦ繛鍫熷閺侇垶姊烘导娆戠暢婵☆偄瀚伴妴鍛附缁嬪灝鑰垮┑鐐村灦鐢帗绂嶉悙顒佸弿婵☆垰娼￠崫娲煛閸℃绠婚柡宀嬬秮婵℃悂濡烽妷顔荤棯闂佽崵鍠愬ú鏍涘┑鍡╁殨濠电姵鑹剧粻濠氭煟閹存梹娅呭ù婊堢畺閺岋繝宕熼銈囶唺闁?*/}
            <TaskEditorDialog
                open={showCreateDialog || showEditDialog}
                mode={showCreateDialog ? "create" : "edit"}
                loading={loading}
                title={showCreateDialog ? t("create_task") : t("edit_task")}
                subtitle={showCreateDialog ? "New Automation Script" : editingTaskName}
                t={t}
                fieldLabelClass={fieldLabelClass}
                taskNamePlaceholder={taskNamePlaceholder}
                sendTextLabel={sendTextLabel}
                clickTextButtonLabel={clickTextButtonLabel}
                sendDiceLabel={sendDiceLabel}
                aiVisionLabel={aiVisionLabel}
                aiCalcLabel={aiCalcLabel}
                aiVisionSendModeLabel={aiVisionSendModeLabel}
                aiVisionClickModeLabel={aiVisionClickModeLabel}
                aiCalcSendModeLabel={aiCalcSendModeLabel}
                aiCalcClickModeLabel={aiCalcClickModeLabel}
                sendTextPlaceholder={sendTextPlaceholder}
                clickButtonPlaceholder={clickButtonPlaceholder}
                chats={chats}
                chatSearch={chatSearch}
                chatSearchResults={chatSearchResults}
                chatSearchLoading={chatSearchLoading}
                refreshingChats={refreshingChats}
                taskName={showCreateDialog ? newTask.name : editingTaskName}
                executionMode={showCreateDialog ? newTask.execution_mode : editTask.execution_mode}
                signAt={showCreateDialog ? newTask.sign_at : editTask.sign_at}
                rangeStart={showCreateDialog ? newTask.range_start : editTask.range_start}
                rangeEnd={showCreateDialog ? newTask.range_end : editTask.range_end}
                actionInterval={showCreateDialog ? newTask.action_interval : editTask.action_interval}
                chatId={showCreateDialog ? newTask.chat_id : editTask.chat_id}
                chatIdManual={showCreateDialog ? newTask.chat_id_manual : editTask.chat_id_manual}
                deleteAfter={showCreateDialog ? newTask.delete_after : editTask.delete_after}
                actions={showCreateDialog ? newTask.actions : editTask.actions}
                onClose={() => {
                    setShowCreateDialog(false);
                    setShowEditDialog(false);
                }}
                onTaskNameChange={(value) => {
                    if (showCreateDialog) {
                        setNewTask({ ...newTask, name: value });
                    }
                }}
                onExecutionModeChange={(value) => showCreateDialog
                    ? setNewTask({ ...newTask, execution_mode: value })
                    : setEditTask({ ...editTask, execution_mode: value })
                }
                onActionIntervalChange={(value) => showCreateDialog
                    ? setNewTask({ ...newTask, action_interval: value })
                    : setEditTask({ ...editTask, action_interval: value })
                }
                onSignAtChange={(value) => showCreateDialog
                    ? setNewTask({ ...newTask, sign_at: value })
                    : setEditTask({ ...editTask, sign_at: value })
                }
                onRangeStartChange={(value) => showCreateDialog
                    ? setNewTask({ ...newTask, range_start: value })
                    : setEditTask({ ...editTask, range_start: value })
                }
                onRangeEndChange={(value) => showCreateDialog
                    ? setNewTask({ ...newTask, range_end: value })
                    : setEditTask({ ...editTask, range_end: value })
                }
                onChatSearchChange={setChatSearch}
                onSelectChat={(chatId, chatName) => {
                    applyChatSelection(chatId, chatName);
                    setChatSearch("");
                    setChatSearchResults([]);
                }}
                onRefreshChats={handleRefreshChats}
                onChatIdManualChange={(value) => {
                    if (showCreateDialog) {
                        setNewTask({ ...newTask, chat_id_manual: value, chat_id: 0 });
                    } else {
                        setEditTask({ ...editTask, chat_id_manual: value, chat_id: 0 });
                    }
                }}
                onDeleteAfterChange={(value) => showCreateDialog
                    ? setNewTask({ ...newTask, delete_after: value })
                    : setEditTask({ ...editTask, delete_after: value })
                }
                onAddAction={showCreateDialog ? handleAddAction : handleEditAddAction}
                onRemoveAction={showCreateDialog ? handleRemoveAction : handleEditRemoveAction}
                onUpdateAction={updateCurrentDialogAction}
                onSubmit={showCreateDialog ? handleCreateTask : handleSaveEdit}
            />
            <SignTaskDialogs
                copyTaskDialog={copyTaskDialog}
                copyTaskDialogTitle={copyTaskDialogTitle}
                copyTaskDialogDesc={copyTaskDialogDesc}
                copyConfigAction={copyConfigAction}
                copyingConfig={copyingConfig}
                pasteTaskTitle={pasteTaskDialogTitle}
                pasteTaskDescription={pasteTaskDialogDesc}
                pasteTaskPlaceholder={pasteTaskDialogPlaceholder}
                showPasteDialog={showPasteDialog}
                pasteTaskConfigInput={pasteTaskConfigInput}
                importingPastedConfig={importingPastedConfig}
                historyTaskName={historyTaskName}
                historyLogs={historyLogs}
                historyLoading={historyLoading}
                showFailedOnly={showFailedOnly}
                showDeleteTaskDialog={showDeleteTaskDialog}
                deleteTaskName={taskToDelete}
                loading={loading}
                isZh={isZh}
                t={t}
                onCloseCopyDialog={closeCopyTaskDialog}
                onCopyTaskConfig={handleCopyTaskConfig}
                onClosePasteDialog={closePasteTaskDialog}
                onPasteTaskConfigChange={setPasteTaskConfigInput}
                onImportPastedTask={handlePasteDialogImport}
                onCloseHistory={() => setHistoryTaskName(null)}
                onToggleFailedOnly={() => setShowFailedOnly(!showFailedOnly)}
                onCloseDeleteDialog={() => setShowDeleteTaskDialog(false)}
                onConfirmDeleteTask={confirmDeleteTask}
            />

            {!embedded && <ToastContainer toasts={toasts} removeToast={removeToast} />}
        </div >
    );
}

