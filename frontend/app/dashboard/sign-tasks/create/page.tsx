"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AccountTasksContent from "../../account-tasks/AccountTasksContent";
import { useLanguage } from "../../../../context/LanguageContext";

function CreateTaskContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const accountName = searchParams.get("name") || "";

  return (
    <AccountTasksContent
      embedded={false}
      initialAccountName={accountName}
      autoOpenCreate={Boolean(accountName)}
    />
  );
}

export default function CreateSignTaskPage() {
  const { t } = useLanguage();

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">{t("loading")}</div>}>
      <CreateTaskContent />
    </Suspense>
  );
}
