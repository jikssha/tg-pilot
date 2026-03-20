"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "../../../context/LanguageContext";

function AccountTasksRedirectContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const accountName = searchParams.get("name");
    const nextUrl = accountName ? `/dashboard?account=${encodeURIComponent(accountName)}` : "/dashboard";

    useEffect(() => {
        router.replace(nextUrl);
    }, [nextUrl, router]);

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white/60">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-[var(--accent-glow)]/20 border-t-[var(--accent-glow)] rounded-full animate-spin"></div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--accent-glow)]/40 font-bold animate-pulse">
                    Redirecting to Dashboard
                </div>
            </div>
        </div>
    );
}

export default function AccountTasksPage() {
    const { t } = useLanguage();
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white/60">{t("loading")}</div>}>
            <AccountTasksRedirectContent />
        </Suspense>
    );
}
