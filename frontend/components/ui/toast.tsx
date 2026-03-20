"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
    id: string;
    message: string;
    type: ToastType;
    closing: boolean;
}

interface ToastProps {
    message: string;
    type?: ToastType;
    closing?: boolean;
    onClose: () => void;
}

export function Toast({ message, type = "info", closing = false, onClose }: ToastProps) {
    const getIcon = () => {
        switch (type) {
            case "success":
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                );
            case "error":
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                );
            default:
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                );
        }
    };

    const getColors = () => {
        switch (type) {
            case "success":
                return "from-emerald-500/20 to-cyan-500/20 border-emerald-500/30 text-emerald-300";
            case "error":
                return "from-red-500/20 to-pink-500/20 border-red-500/30 text-red-300";
            default:
                return "from-blue-500/20 to-purple-500/20 border-blue-500/30 text-blue-300";
        }
    };

    const getIconBg = () => {
        switch (type) {
            case "success":
                return "bg-emerald-500/20";
            case "error":
                return "bg-red-500/20";
            default:
                return "bg-blue-500/20";
        }
    };

    return (
        <div
            className={`
        ${closing ? "toast-exit" : "toast-enter"}
        flex items-center gap-3 px-4 py-3 rounded-xl
        bg-gradient-to-r ${getColors()}
        backdrop-blur-xl border
        shadow-lg shadow-black/20
        min-w-[280px] max-w-[400px]
      `}
            data-testid={`toast-${type}`}
        >
            <div className={`p-2 rounded-lg ${getIconBg()}`}>
                {getIcon()}
            </div>
            <p className="text-sm font-medium text-white/90 flex-1">{message}</p>
            <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white/80"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}

interface ToastContainerProps {
    toasts: ToastItem[];
    removeToast: (id: string) => void;
}

export function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
    return (
        <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-3">
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    closing={toast.closing}
                    onClose={() => removeToast(toast.id)}
                />
            ))}
        </div>
    );
}

// Hook for managing toasts
export function useToast() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const closeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const removeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const dedupeRef = useRef<Map<string, number>>(new Map());

    const clearTimer = (timerMap: Map<string, ReturnType<typeof setTimeout>>, id: string) => {
        const timer = timerMap.get(id);
        if (timer) {
            clearTimeout(timer);
            timerMap.delete(id);
        }
    };

    const finalizeRemove = useCallback((id: string) => {
        clearTimer(closeTimersRef.current, id);
        clearTimer(removeTimersRef.current, id);
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const removeToast = useCallback((id: string) => {
        clearTimer(closeTimersRef.current, id);
        setToasts((prev) => {
            let found = false;
            const next = prev.map((toast) => {
                if (toast.id !== id) {
                    return toast;
                }
                found = true;
                if (toast.closing) {
                    return toast;
                }
                return { ...toast, closing: true };
            });
            if (!found) {
                return prev;
            }
            if (!removeTimersRef.current.has(id)) {
                removeTimersRef.current.set(
                    id,
                    setTimeout(() => finalizeRemove(id), 300)
                );
            }
            return next;
        });
    }, [finalizeRemove]);

    const addToast = useCallback((message: string, type: ToastType = "info", duration = 4000) => {
        const dedupeKey = `${type}:${message}`;
        const now = Date.now();
        const previousShownAt = dedupeRef.current.get(dedupeKey);
        if (previousShownAt && now - previousShownAt < 500) {
            return null;
        }
        dedupeRef.current.set(dedupeKey, now);

        const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
        setToasts((prev) => [...prev, { id, message, type, closing: false }]);
        closeTimersRef.current.set(
            id,
            setTimeout(() => removeToast(id), duration)
        );
        return id;
    }, [removeToast]);

    useEffect(() => {
        const closeTimers = closeTimersRef.current;
        const removeTimers = removeTimersRef.current;
        return () => {
            for (const timer of Array.from(closeTimers.values())) {
                clearTimeout(timer);
            }
            for (const timer of Array.from(removeTimers.values())) {
                clearTimeout(timer);
            }
            closeTimers.clear();
            removeTimers.clear();
        };
    }, []);

    return { toasts, addToast, removeToast };
}
