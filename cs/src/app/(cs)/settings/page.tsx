"use client";

import { useEffect, useState } from "react";
import { apiClient, ApiError } from "@/services/apiClient";

interface StaffProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "超級管理員",
  ADMIN: "管理員",
  CUSTOMER_SERVICE: "客服專員",
  SUPPORT: "客服",
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Notification preferences (placeholder state)
  const [notifyNewTicket, setNotifyNewTicket] = useState(true);
  const [notifyAssigned, setNotifyAssigned] = useState(true);
  const [notifyPlayerReply, setNotifyPlayerReply] = useState(true);

  useEffect(() => {
    const staffId =
      typeof window !== "undefined"
        ? sessionStorage.getItem("csStaffId")
        : null;

    if (!staffId) {
      setIsLoadingProfile(false);
      return;
    }

    apiClient
      .get<StaffProfile>(`/api/v1/admin/staff/${staffId}`)
      .then((data) => {
        setProfile(data);
        setDisplayName(data.name);
      })
      .catch(() => {
        // Fall back to session data
        setProfile({
          id: staffId,
          name: sessionStorage.getItem("csStaffName") ?? "",
          email: "",
          role: sessionStorage.getItem("csRole") ?? "CUSTOMER_SERVICE",
        });
        setDisplayName(sessionStorage.getItem("csStaffName") ?? "");
      })
      .finally(() => setIsLoadingProfile(false));
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      await apiClient.patch(`/api/v1/admin/staff/${profile.id}`, {
        name: displayName.trim(),
      });
      sessionStorage.setItem("csStaffName", displayName.trim());
      setProfileSuccess("顯示名稱已更新");
    } catch (err) {
      setProfileError(
        err instanceof ApiError ? err.message : "更新失敗，請稍後再試",
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError("新密碼至少需要 8 個字元");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("兩次輸入的密碼不一致");
      return;
    }

    setIsSavingPassword(true);
    try {
      await apiClient.post("/api/v1/auth/change-password", {
        currentPassword,
        newPassword,
      });
      setPasswordSuccess("密碼已更新，請使用新密碼重新登入");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setPasswordError("目前密碼不正確");
      } else {
        setPasswordError(
          err instanceof Error ? err.message : "更新密碼失敗",
        );
      }
    } finally {
      setIsSavingPassword(false);
    }
  }

  if (isLoadingProfile) {
    return (
      <div className="flex h-64 items-center justify-center">
        <svg
          className="h-5 w-5 animate-spin text-indigo-600"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-5">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">個人設定</h1>
        <p className="text-sm text-slate-500">管理您的帳號資訊與偏好設定</p>
      </div>

      {/* Profile card */}
      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          基本資料
        </h2>

        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-xl font-bold text-white">
            {(profile?.name ?? "?").charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-900">
              {profile?.name ?? "—"}
            </p>
            <p className="text-sm text-slate-500">{profile?.email ?? "—"}</p>
            <span className="mt-0.5 inline-block rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
              {ROLE_LABELS[profile?.role ?? ""] ?? profile?.role ?? "—"}
            </span>
          </div>
        </div>

        <form onSubmit={handleSaveProfile}>
          {profileError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {profileError}
            </div>
          )}
          {profileSuccess && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {profileSuccess}
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="display-name"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              顯示名稱
            </label>
            <input
              id="display-name"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              電子郵件
            </label>
            <input
              type="email"
              value={profile?.email ?? ""}
              readOnly
              className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500"
            />
            <p className="mt-1 text-xs text-slate-400">
              電子郵件不可自行修改，請聯絡管理員
            </p>
          </div>

          <button
            type="submit"
            disabled={isSavingProfile}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSavingProfile ? "儲存中..." : "儲存名稱"}
          </button>
        </form>
      </section>

      {/* Change password */}
      <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          變更密碼
        </h2>

        <form onSubmit={handleChangePassword}>
          {passwordError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {passwordSuccess}
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="current-password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              目前密碼
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="new-password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              新密碼
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <p className="mt-1 text-xs text-slate-400">至少 8 個字元</p>
          </div>

          <div className="mb-5">
            <label
              htmlFor="confirm-password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              確認新密碼
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                confirmPassword && confirmPassword !== newPassword
                  ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
                  : "border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/20"
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={isSavingPassword}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSavingPassword ? "更新中..." : "更新密碼"}
          </button>
        </form>
      </section>

      {/* Notification preferences (placeholder) */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900">通知設定</h2>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
            即將推出
          </span>
        </div>

        <div className="space-y-3 opacity-60">
          {[
            {
              id: "notify-new",
              label: "新工單通知",
              desc: "有新工單建立時通知",
              checked: notifyNewTicket,
              onChange: setNotifyNewTicket,
            },
            {
              id: "notify-assigned",
              label: "指派通知",
              desc: "工單指派給我時通知",
              checked: notifyAssigned,
              onChange: setNotifyAssigned,
            },
            {
              id: "notify-reply",
              label: "玩家回覆通知",
              desc: "玩家在我的工單回覆時通知",
              checked: notifyPlayerReply,
              onChange: setNotifyPlayerReply,
            },
          ].map((item) => (
            <label
              key={item.id}
              htmlFor={item.id}
              className="flex cursor-not-allowed items-center justify-between rounded-lg border border-slate-200 p-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {item.label}
                </p>
                <p className="text-xs text-slate-400">{item.desc}</p>
              </div>
              <input
                id={item.id}
                type="checkbox"
                disabled
                checked={item.checked}
                onChange={(e) => item.onChange(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
