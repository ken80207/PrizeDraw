"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authStore, subscribeToAuthStore } from "@/stores/authStore";
import type { PlayerDto } from "@/stores/authStore";
import { apiClient } from "@/services/apiClient";
import { toast } from "@/components/Toast";

type AnimationMode = "TEAR" | "SCRATCH" | "FLIP" | "INSTANT";

const ANIMATION_MODES: { value: AnimationMode; label: string; icon: string; description: string }[] = [
  { value: "TEAR", label: "撕籤模式", icon: "📜", description: "滑動撕開籤封，真實手感體驗" },
  { value: "SCRATCH", label: "刮刮樂", icon: "🪙", description: "刮開塗層揭曉賞品，緊張刺激" },
  { value: "FLIP", label: "翻牌", icon: "🃏", description: "3D 翻牌動畫，華麗視覺效果" },
  { value: "INSTANT", label: "快速揭曉", icon: "⚡", description: "立即顯示結果，適合連抽時使用" },
];

const LANGUAGES = [
  { value: "zh-TW", label: "繁體中文" },
  { value: "zh-CN", label: "简体中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<PlayerDto | null>(null);
  const [nickname, setNickname] = useState("");
  const [editingNickname, setEditingNickname] = useState(false);
  const [animationMode, setAnimationMode] = useState<AnimationMode>("INSTANT");
  const [language, setLanguage] = useState("zh-TW");
  const [saving, setSaving] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);

  useEffect(() => {
    setPlayer(authStore.player);
    if (authStore.player) {
      setNickname(authStore.player.nickname);
      setAnimationMode(
        (authStore.player.preferredAnimationMode as AnimationMode) ?? "INSTANT",
      );
      setLanguage(authStore.player.locale ?? "zh-TW");
    }
    const unsub = subscribeToAuthStore(() => {
      const p = authStore.player;
      setPlayer(p);
      if (p) {
        setNickname(p.nickname);
        setAnimationMode((p.preferredAnimationMode as AnimationMode) ?? "INSTANT");
        setLanguage(p.locale ?? "zh-TW");
      }
    });
    return unsub;
  }, []);

  async function handleSaveAnimationMode(mode: AnimationMode) {
    setAnimationMode(mode);
    setSaving(true);
    try {
      await apiClient.patch("/api/v1/players/me/preferences/animation", {
        animationMode: mode,
      });
      toast.success("動畫偏好已儲存");
    } catch {
      toast.error("儲存失敗，請稍後再試");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNickname() {
    if (!nickname.trim() || nickname.trim() === player?.nickname) {
      setEditingNickname(false);
      return;
    }
    setSavingNickname(true);
    try {
      await apiClient.patch("/api/v1/players/me", { nickname: nickname.trim() });
      toast.success("暱稱已更新");
      setEditingNickname(false);
    } catch {
      toast.error("更新暱稱失敗");
    } finally {
      setSavingNickname(false);
    }
  }

  async function handleSaveLanguage(lang: string) {
    setLanguage(lang);
    try {
      await apiClient.patch("/api/v1/players/me", { locale: lang });
      toast.success("語言設定已儲存");
    } catch {
      toast.error("儲存失敗");
    }
  }

  function handleLogout() {
    authStore.clearSession();
    toast.info("已登出");
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">設定</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            管理你的帳戶偏好與個人資料
          </p>
        </div>

        {/* ── Profile section ──────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">個人資料</h2>

          <div className="flex items-center gap-4 mb-5">
            {/* Avatar */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                {player?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={player.avatarUrl}
                    alt={player.nickname}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  player?.nickname?.charAt(0)?.toUpperCase() ?? "?"
                )}
              </div>
              <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center hover:bg-indigo-700 transition-colors">
                +
              </button>
            </div>

            {/* Nickname */}
            <div className="flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">暱稱</p>
              {editingNickname ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={30}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-indigo-400 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveNickname}
                    disabled={savingNickname}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingNickname ? "儲存中..." : "儲存"}
                  </button>
                  <button
                    onClick={() => { setEditingNickname(false); setNickname(player?.nickname ?? ""); }}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 text-xs hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {player?.nickname ?? "未設定"}
                  </span>
                  <button
                    onClick={() => setEditingNickname(true)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    編輯
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Animation preference ─────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">開獎動畫偏好</h2>
            {saving && (
              <span className="text-xs text-gray-400 dark:text-gray-500">儲存中...</span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            選擇每次抽獎後揭曉賞品的動畫方式
          </p>
          <div className="grid grid-cols-2 gap-3">
            {ANIMATION_MODES.map(({ value, label, icon, description }) => (
              <button
                key={value}
                type="button"
                data-testid={`animation-${value.toLowerCase()}`}
                onClick={() => handleSaveAnimationMode(value)}
                disabled={saving}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  animationMode === value
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      animationMode === value
                        ? "border-indigo-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}
                  >
                    {animationMode === value && (
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    )}
                  </div>
                  <span className="text-base">{icon}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">{description}</p>
              </button>
            ))}
          </div>
        </section>

        {/* ── Language ─────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">語言設定</h2>
          <select
            value={language}
            onChange={(e) => handleSaveLanguage(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </section>

        {/* ── Account security ─────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">帳戶安全</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">綁定手機號碼</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {player?.phoneNumber
                  ? player.phoneNumber.replace(/(\d{4})\d{3}(\d{3})/, "$1-XXX-$2")
                  : "尚未綁定手機號碼"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {player?.phoneNumber ? (
                <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>✓</span> 已綁定
                </span>
              ) : (
                <button className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors">
                  立即綁定
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── Logout ───────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-red-100 dark:border-red-900/30 p-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">登出帳號</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            登出後需要重新登入才能使用抽獎及交易功能
          </p>
          <button
            onClick={handleLogout}
            className="px-6 py-2.5 rounded-xl border-2 border-red-400 dark:border-red-700 text-red-600 dark:text-red-400 font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            登出
          </button>
        </section>
      </div>
    </div>
  );
}
