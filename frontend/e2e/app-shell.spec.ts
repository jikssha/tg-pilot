import { expect, test, Page } from "@playwright/test";

const TOKEN_KEY = "tg-pilot-token";

async function setToken(page: Page) {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, "playwright-token");
  }, TOKEN_KEY);
}

async function mockDashboardApis(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/api/accounts") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accounts: [
            { name: "demo-main", session_file: "demo-main.session", exists: true, size: 128, remark: "主账号", proxy: "" },
            { name: "demo-backup", session_file: "demo-backup.session", exists: true, size: 96, remark: "备用账号", proxy: "" },
          ],
          total: 2,
        }),
      });
      return;
    }

    if (path === "/api/sign-tasks") {
      const accountName = url.searchParams.get("account_name");
      const tasks = accountName
        ? [
            {
              name: "daily-checkin",
              account_name: accountName,
              sign_at: "0 6 * * *",
              random_seconds: 0,
              execution_mode: "fixed",
              range_start: null,
              range_end: null,
              chats: [{ chat_id: -100123, name: "签到频道", actions: [{ action: 1, text: "/checkin" }], action_interval: 10 }],
              last_run: null,
            },
          ]
        : [
            {
              name: "daily-checkin",
              account_name: "demo-main",
              sign_at: "0 6 * * *",
              random_seconds: 0,
              execution_mode: "fixed",
              range_start: null,
              range_end: null,
              chats: [{ chat_id: -100123, name: "签到频道", actions: [{ action: 1, text: "/checkin" }], action_interval: 10 }],
              last_run: null,
            },
          ];

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(tasks),
      });
      return;
    }

    if (path === "/api/accounts/status/check") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [
            { account_name: "demo-main", ok: true, status: "valid", checked_at: new Date().toISOString(), needs_relogin: false },
            { account_name: "demo-backup", ok: true, status: "valid", checked_at: new Date().toISOString(), needs_relogin: false },
          ],
        }),
      });
      return;
    }

    if (path === "/api/sign-tasks/chats/demo-main") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: -100123, title: "签到频道", username: "daily_sign", type: "channel" },
          { id: -100456, title: "任务群组", username: "task_group", type: "group" },
        ]),
      });
      return;
    }

    if (path === "/api/sign-tasks/chats/demo-main/search") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          total: 1,
          limit: 50,
          offset: 0,
          items: [{ id: -100123, title: "签到频道", username: "daily_sign", type: "channel" }],
        }),
      });
      return;
    }

    if (path === "/api/auth/totp/status") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ enabled: false }) });
      return;
    }

    if (path === "/api/config/ai") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ has_config: false }) });
      return;
    }

    if (path === "/api/config/settings") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ sign_interval: null, log_retention_days: 7, data_dir: null, server_time: "09:30" }) });
      return;
    }

    if (path === "/api/config/telegram") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ api_id: "", api_hash: "", is_custom: false, default_api_id: "", default_api_hash: "" }) });
      return;
    }

    if (path === "/api/config/bot-notify") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ has_config: false, enabled: false, chat_id: "" }) });
      return;
    }

    if (path === "/api/config/ops/overview") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          readiness: {
            ready: true,
            checks: { storage: true, database: true, scheduler: true, jobs_synced: true },
            details: {},
          },
          scheduler: {
            running: true,
            job_count: 3,
            jobs: [{ id: "sign-demo-main-daily-checkin", next_run_time: new Date().toISOString() }],
          },
          accounts: {
            total: 2,
            statuses: { valid: 2 },
          },
          sign_tasks: {
            total: 2,
            enabled: 2,
            disabled: 0,
            last_run_success: 1,
            last_run_failed: 0,
            never_run: 1,
          },
          recent_audit: [
            {
              id: 1,
              action: "import_all_configs",
              resource_type: "config_bundle",
              resource_id: "all",
              actor: "admin",
              status: "success",
              details: { overwrite: false },
              created_at: new Date().toISOString(),
            },
          ],
          latest_audit_at: new Date().toISOString(),
        }),
      });
      return;
    }

    if (path === "/api/config/audit/events") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: 1,
              action: "import_all_configs",
              resource_type: "config_bundle",
              resource_id: "all",
              actor: "admin",
              status: "success",
              details: { overwrite: false, signs_imported: 2 },
              created_at: new Date().toISOString(),
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
}

test("login page renders the control center entry", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("登录 TG-Pilot")).toBeVisible();
  await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
});

test("dashboard loads accounts and renders the detail workspace", async ({ page }) => {
  await setToken(page);
  await mockDashboardApis(page);

  await page.goto("/dashboard");

  await expect(page.getByText("demo-main")).toBeVisible();
  await page.getByText("demo-main").click();
  await expect(page.getByText("签到任务")).toBeVisible();
});

test("sign task create route opens the editor when account is provided", async ({ page }) => {
  await setToken(page);
  await mockDashboardApis(page);

  await page.goto("/dashboard/sign-tasks/create?name=demo-main");

  await expect(page.getByText("创建签到任务")).toBeVisible();
  await expect(page.getByLabel("任务名称")).toBeVisible();
});

test("settings page renders system control center with mocked config", async ({ page }) => {
  await setToken(page);
  await mockDashboardApis(page);

  await page.goto("/dashboard/settings");

  await expect(page.getByText("系统控制面板")).toBeVisible();
  await expect(page.getByText("账户安全与验证")).toBeVisible();
  await page.getByRole("button", { name: "系统运维概览" }).click();
  await expect(page.getByRole("heading", { name: "系统运维概览" })).toBeVisible();
  await page.getByRole("button", { name: "审计事件追踪" }).click();
  await expect(page.getByRole("heading", { name: "审计事件追踪" })).toBeVisible();
});
