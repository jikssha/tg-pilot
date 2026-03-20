"use client";

import { useEffect, useState } from "react";
import LoginForm from "../components/login-form";
import { getToken } from "../lib/auth";

export default function Home() {
  const [hasToken, setHasToken] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // 检查是否有 token
    const token = getToken();
    setHasToken(!!token);
    setChecking(false);

    // 如果有 token，且当前是根路径，则使用 replace 跳转到 dashboard
    if (token && window.location.pathname === "/") {
      window.location.replace("/dashboard");
    }
  }, []);

  if (checking || hasToken) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-8 h-8 border-2 border-[var(--accent-glow)]/20 border-t-[var(--accent-glow)] rounded-full animate-spin"></div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--accent-glow)]/40 font-bold animate-pulse">
            {hasToken ? "Redirecting to Dashboard" : "Checking Session"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <LoginForm />
    </div>
  );
}
