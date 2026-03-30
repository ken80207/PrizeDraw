"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { authStore, subscribeToAuthStore, useAuthStore } from "@/stores/authStore";
import type { PlayerDto } from "@/stores/authStore";
import { apiClient } from "@/services/apiClient";
import { toast } from "@/components/Toast";

type AnimationMode = "TEAR" | "SCRATCH" | "FLIP" | "INSTANT";

const LANGUAGES = [
  { value: "zh-TW", label: "繁體中文" },
  { value: "zh-CN", label: "简体中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
];

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tFollow = useTranslations("follow");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [player, setPlayer] = useState<PlayerDto | null>(null);

  useEffect(() => {
    // Wait for localStorage rehydration before deciding to redirect, to avoid
    // a false redirect on the initial render where isAuthenticated is still false.
    if (hasHydrated && !isAuthenticated) {
      router.push("/login");
    }
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated || !isAuthenticated) {
    return null;
  }
  const [nickname, setNickname] = useState("");
  const [editingNickname, setEditingNickname] = useState(false);
  const [animationMode, setAnimationMode] = useState<AnimationMode>("INSTANT");
  const [language, setLanguage] = useState("zh-TW");
  const [saving, setSaving] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);
  const [copied, setCopied] = useState(false);

  const ANIMATION_MODES: { value: AnimationMode; label: string; icon: string; description: string }[] = [
    { value: "TEAR", label: t("tearModeLabel"), icon: "description", description: t("tearModeDesc") },
    { value: "SCRATCH", label: t("scratchModeLabel"), icon: "monetization_on", description: t("scratchModeDesc") },
    { value: "FLIP", label: t("flipModeLabel"), icon: "style", description: t("flipModeDesc") },
    { value: "INSTANT", label: t("instantModeLabel"), icon: "bolt", description: t("instantModeDesc") },
  ];

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
      toast.success(t("animationSaved"));
    } catch {
      toast.error(t("animationSaveFailed"));
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
      toast.success(t("nicknameSaved"));
      setEditingNickname(false);
    } catch {
      toast.error(t("nicknameSaveFailed"));
    } finally {
      setSavingNickname(false);
    }
  }

  async function handleSaveLanguage(lang: string) {
    setLanguage(lang);
    try {
      await apiClient.patch("/api/v1/players/me", { locale: lang });
      toast.success(t("languageSaved"));
    } catch {
      toast.error(t("languageSaveFailed"));
    }
  }

  const handleCopy = useCallback(async () => {
    if (player?.playerCode) {
      await navigator.clipboard.writeText(player.playerCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [player?.playerCode]);

  function handleLogout() {
    authStore.clearSession();
    toast.info(t("loggedOut"));
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-[#111125]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 p-6 lg:p-10 space-y-5">
        {/* Header */}
        <div className="mb-2">
          <h1 className="font-headline text-3xl font-bold text-[#e2e0fc]">{t("title")}</h1>
          <p className="mt-1 text-sm text-[#d8c3ad]">
            {t("subtitle")}
          </p>
        </div>

        {/* Profile section */}
        <section className="bg-[#1e1e32] rounded-2xl p-5">
          <h2 className="font-headline text-base font-bold text-[#e2e0fc] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffc174] text-xl">person</span>
            {t("profile")}
          </h2>

          <div className="flex items-center gap-4 mb-5">
            {/* Avatar */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#ffc174] to-[#f59e0b] flex items-center justify-center text-[#472a00] text-2xl font-bold overflow-hidden">
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
              <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full amber-gradient text-[#472a00] text-xs flex items-center justify-center hover:opacity-90 transition-opacity shadow-md">
                <span className="material-symbols-outlined text-xs" style={{ fontSize: "14px" }}>
                  edit
                </span>
              </button>
            </div>

            {/* Nickname */}
            <div className="flex-1">
              <p className="text-xs text-[#d8c3ad] mb-1 uppercase tracking-wider">{t("nickname")}</p>
              {editingNickname ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={30}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-[#0c0c1f] text-sm text-[#e2e0fc] focus:outline-none focus:ring-1 focus:ring-[#ffc174] border-none"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveNickname}
                    disabled={savingNickname}
                    className="px-3 py-1.5 rounded-xl amber-gradient text-[#472a00] text-xs font-bold disabled:opacity-50"
                  >
                    {savingNickname ? tCommon("saving") : tCommon("save")}
                  </button>
                  <button
                    onClick={() => { setEditingNickname(false); setNickname(player?.nickname ?? ""); }}
                    className="px-3 py-1.5 rounded-xl bg-transparent border border-[#534434]/20 text-[#d8c3ad] text-xs hover:bg-[#28283d] transition-colors"
                  >
                    {tCommon("cancel")}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#e2e0fc]">
                    {player?.nickname ?? t("notSet")}
                  </span>
                  <button
                    onClick={() => setEditingNickname(true)}
                    className="text-xs text-[#ffc174] hover:underline"
                  >
                    {tCommon("edit")}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Phone number row */}
          <div className="bg-[#0c0c1f] rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#d8c3ad] mb-0.5 uppercase tracking-wider">{t("phoneNumber")}</p>
              <p className="text-sm font-medium text-[#e2e0fc]">
                {player?.phoneNumber
                  ? player.phoneNumber.replace(/(\d{4})\d{3}(\d{3})/, "$1-XXX-$2")
                  : t("notBound")}
              </p>
            </div>
            {player?.phoneNumber ? (
              <span className="flex items-center gap-1 text-xs text-[#8fd5ff] font-medium">
                <span className="material-symbols-outlined text-sm" style={{ fontSize: "16px" }}>
                  verified
                </span>
                {t("bound")}
              </span>
            ) : (
              <button className="px-3 py-1.5 rounded-xl amber-gradient text-[#472a00] text-xs font-bold">
                {t("bindNow")}
              </button>
            )}
          </div>

          {/* Player code row */}
          <div className="bg-[#0c0c1f] rounded-xl px-4 py-3 mt-3 flex items-center justify-between">
            <p className="text-xs text-[#d8c3ad] uppercase tracking-wider">{tFollow("playerCode")}</p>
            <div className="flex items-center gap-2">
              <code className="font-mono text-[#e2e0fc] bg-[#1e1e32] px-2 py-1 rounded text-sm tracking-wider">
                {player?.playerCode}
              </code>
              <button
                onClick={handleCopy}
                className="text-[#ffc174] hover:text-[#f59e0b] transition-colors"
                aria-label="Copy code"
              >
                <span className="material-symbols-outlined text-xl">
                  {copied ? "check" : "content_copy"}
                </span>
              </button>
            </div>
          </div>

          {/* Follow stats */}
          <div className="flex gap-4 mt-3 px-1 text-sm text-[#d8c3ad]">
            <span>{tFollow("followerCount", { count: player?.followerCount ?? 0 })}</span>
            <span>{tFollow("followingCount", { count: player?.followingCount ?? 0 })}</span>
          </div>
        </section>

        {/* Animation preference */}
        <section className="bg-[#1e1e32] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-headline text-base font-bold text-[#e2e0fc] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ffc174] text-xl">auto_awesome</span>
              {t("animationPrefs")}
            </h2>
            {saving && (
              <span className="text-xs text-[#d8c3ad]/60">{tCommon("saving")}</span>
            )}
          </div>
          <p className="text-sm text-[#d8c3ad] mb-4">
            {t("animationDescDetail")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {ANIMATION_MODES.map(({ value, label, icon, description }) => (
              <button
                key={value}
                type="button"
                data-testid={`animation-${value.toLowerCase()}`}
                onClick={() => handleSaveAnimationMode(value)}
                disabled={saving}
                className={`text-left p-4 rounded-xl transition-all ${
                  animationMode === value
                    ? "bg-[#28283d] shadow-[inset_0_0_0_1px_rgba(255,193,116,0.4)]"
                    : "bg-[#0c0c1f] hover:bg-[#1a1a2e]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      animationMode === value
                        ? "amber-gradient"
                        : "bg-[#28283d]"
                    }`}
                  >
                    {animationMode === value && (
                      <span className="material-symbols-outlined text-[#472a00]" style={{ fontSize: "12px" }}>
                        check
                      </span>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-[#ffc174] text-base">
                    {icon}
                  </span>
                  <span className="text-sm font-semibold text-[#e2e0fc]">
                    {label}
                  </span>
                </div>
                <p className="text-xs text-[#d8c3ad] ml-7">{description}</p>
              </button>
            ))}
          </div>
        </section>

        {/* App Settings */}
        <section className="bg-[#1e1e32] rounded-2xl p-5">
          <h2 className="font-headline text-base font-bold text-[#e2e0fc] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffc174] text-xl">tune</span>
            {t("appSettings")}
          </h2>

          {/* Language row */}
          <div className="bg-[#0c0c1f] rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#d8c3ad] mb-0.5 uppercase tracking-wider">{t("language")}</p>
            </div>
            <select
              value={language}
              onChange={(e) => handleSaveLanguage(e.target.value)}
              className="bg-transparent text-sm text-[#ffc174] font-medium focus:outline-none cursor-pointer"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value} className="bg-[#1e1e32] text-[#e2e0fc]">
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Security */}
        <section className="bg-[#1e1e32] rounded-2xl p-5">
          <h2 className="font-headline text-base font-bold text-[#e2e0fc] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffc174] text-xl">security</span>
            {t("security")}
          </h2>
          <div className="bg-[#0c0c1f] rounded-xl px-4 py-3">
            <button className="flex items-center justify-between w-full group">
              <span className="text-sm font-medium text-[#e2e0fc]">{t("bindPhoneNumber")}</span>
              <span className="material-symbols-outlined text-[#d8c3ad]/50 group-hover:text-[#ffc174] transition-colors text-sm">
                chevron_right
              </span>
            </button>
          </div>
        </section>

        {/* Logout */}
        <section className="bg-[#1e1e32] rounded-2xl p-5">
          <h2 className="font-headline text-base font-bold text-[#e2e0fc] mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ffb4ab] text-xl">logout</span>
            {t("logoutAccount")}
          </h2>
          <p className="text-sm text-[#d8c3ad] mb-4">
            {t("logoutDesc2")}
          </p>
          <button
            onClick={handleLogout}
            className="px-6 py-2.5 rounded-xl border border-[#ffb4ab]/30 text-[#ffb4ab] font-semibold text-sm hover:bg-[#ffb4ab]/10 transition-colors"
          >
            {t("logout")}
          </button>
        </section>
      </div>
    </div>
  );
}
