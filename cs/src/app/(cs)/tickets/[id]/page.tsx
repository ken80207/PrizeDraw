"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/services/apiClient";
import { ChatBubble } from "@/components/ChatBubble";
import { PlayerContextPanel } from "@/components/PlayerContextPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { CategoryIcon, getCategoryLabel } from "@/components/CategoryIcon";

/* ------------------------------------------------------------------ */
/* Types                                                                 */
/* ------------------------------------------------------------------ */

interface TicketMessage {
  id: string;
  senderType: string;
  body: string;
  senderId?: string | null;
  isRead: boolean;
  createdAt: string;
}

interface StaffMember {
  id: string;
  name: string;
}

interface TicketDetail {
  id: string;
  ticketNumber: number;
  playerId: string;
  playerName: string;
  category: string;
  subject: string;
  status: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  createdAt: string;
  lastMessageAt: string;
  messages: TicketMessage[];
}

interface PlayerContext {
  id: string;
  nickname: string;
  phone?: string;
  email?: string;
  drawPoints: number;
  revenuePoints: number;
  accountStatus: string;
  registeredAt: string;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string;
    createdAt: string;
  }>;
  recentDraws: Array<{
    id: string;
    campaignName: string;
    result: string;
    createdAt: string;
  }>;
  prizeInventory: Array<{
    id: string;
    prizeName: string;
    status: string;
  }>;
}

/* ------------------------------------------------------------------ */
/* Transfer modal                                                        */
/* ------------------------------------------------------------------ */

function TransferModal({
  staffList,
  onConfirm,
  onClose,
}: {
  staffList: StaffMember[];
  onConfirm: (staffId: string) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-base font-semibold text-slate-900">
          轉交工單
        </h3>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">請選擇客服人員</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!selectedId}
            onClick={() => selectedId && onConfirm(selectedId)}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
          >
            確認轉交
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Close modal                                                           */
/* ------------------------------------------------------------------ */

function CloseTicketModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (satisfaction: number | null, note: string) => void;
  onClose: () => void;
}) {
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-1 text-base font-semibold text-slate-900">
          關閉工單
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          工單關閉後玩家將無法繼續回覆。
        </p>

        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-slate-700">
            滿意度評分（選填）
          </p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSatisfaction(n)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                  satisfaction === n
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-200 text-slate-600 hover:border-indigo-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label
            htmlFor="close-note"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            備註（選填）
          </label>
          <textarea
            id="close-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="請輸入結案備註..."
            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onConfirm(satisfaction, note)}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            確認關閉
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page component                                                   */
/* ------------------------------------------------------------------ */

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [player, setPlayer] = useState<PlayerContext | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoadingTicket, setIsLoadingTicket] = useState(true);
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load current staff ID
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentStaffId(sessionStorage.getItem("csStaffId"));
    }
  }, []);

  const fetchTicket = useCallback(async () => {
    try {
      const data = await apiClient.get<TicketDetail>(
        `/api/v1/support/tickets/${ticketId}`,
      );
      setTicket(data);
      return data;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "載入工單失敗");
      return null;
    } finally {
      setIsLoadingTicket(false);
    }
  }, [ticketId]);

  // TODO: No CS player detail endpoint in api-contracts.
  // Replace with the correct endpoint once added (e.g. GET /api/v1/admin/players/{id}).
  const fetchPlayer = useCallback(async (playerId: string) => {
    setIsLoadingPlayer(true);
    try {
      const data = await apiClient.get<PlayerContext>(
        `/api/v1/admin/players/${playerId}`,
      );
      setPlayer(data);
    } catch {
      // player context is best-effort
    } finally {
      setIsLoadingPlayer(false);
    }
  }, []);

  // TODO: No staff list endpoint in api-contracts.
  // Replace with the correct endpoint once added (e.g. GET /api/v1/admin/staff).
  const fetchStaffList = useCallback(async () => {
    try {
      const data = await apiClient.get<StaffMember[]>("/api/v1/admin/staff");
      setStaffList(data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void fetchTicket().then((t) => {
      if (t) void fetchPlayer(t.playerId);
    });
    void fetchStaffList();
  }, [fetchTicket, fetchPlayer, fetchStaffList]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages]);

  // Handle reply submit
  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || isSending) return;

    setIsSending(true);
    setActionError(null);
    try {
      await apiClient.post(`/api/v1/support/tickets/${ticketId}/reply`, {
        ticketId,
        body: replyText.trim(),
      });
      setReplyText("");
      await fetchTicket();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "送出回覆失敗");
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }

  // Handle keyboard shortcut (Ctrl+Enter)
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      void handleSendReply(e as unknown as React.FormEvent);
    }
  }

  // Assign to self
  // TODO: No assign endpoint defined in api-contracts. This will fail until
  // the server adds POST/PATCH /api/v1/support/tickets/{id}/assign.
  async function handleAssignToMe() {
    if (!currentStaffId) return;
    setActionError(null);
    try {
      await apiClient.patch(`/api/v1/support/tickets/${ticketId}/assign`, {
        staffId: currentStaffId,
      });
      await fetchTicket();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "指派失敗");
    }
  }

  // Transfer ticket
  async function handleTransfer(staffId: string) {
    setShowTransferModal(false);
    setActionError(null);
    try {
      await apiClient.patch(`/api/v1/support/tickets/${ticketId}/assign`, {
        staffId,
      });
      await fetchTicket();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "轉交失敗");
    }
  }

  // Close ticket — POST /api/v1/support/tickets/{id}/close with CloseTicketRequest
  async function handleClose(satisfaction: number | null, _note: string) {
    setShowCloseModal(false);
    setActionError(null);
    try {
      await apiClient.post(`/api/v1/support/tickets/${ticketId}/close`, {
        ticketId,
        satisfactionScore: satisfaction,
      });
      await fetchTicket();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "關閉工單失敗");
    }
  }

  if (isLoadingTicket) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
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
          載入工單中...
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-slate-500">
        <span className="text-4xl">😕</span>
        <p className="text-base font-medium">找不到工單</p>
        <button
          type="button"
          onClick={() => router.push("/tickets")}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          返回工單列表
        </button>
      </div>
    );
  }

  const isClosed =
    ticket.status === "RESOLVED" || ticket.status === "CLOSED";

  return (
    <>
      {/* Modals */}
      {showTransferModal && (
        <TransferModal
          staffList={staffList}
          onConfirm={handleTransfer}
          onClose={() => setShowTransferModal(false)}
        />
      )}
      {showCloseModal && (
        <CloseTicketModal
          onConfirm={handleClose}
          onClose={() => setShowCloseModal(false)}
        />
      )}

      <div className="flex h-full flex-col">
        {/* Header bar */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/tickets"
              className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="返回工單列表"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <span className="font-mono text-sm font-semibold text-slate-400">
              #{ticket.ticketNumber}
            </span>
            <CategoryIcon category={ticket.category} />
            <span className="text-xs text-slate-500">
              {getCategoryLabel(ticket.category)}
            </span>
            <h1 className="truncate text-sm font-semibold text-slate-900">
              {ticket.subject}
            </h1>
          </div>
          <div className="ml-4 flex flex-shrink-0 items-center gap-3">
            <StatusBadge status={ticket.status} size="md" />
            {ticket.assignedStaffName && (
              <span className="hidden rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 sm:block">
                {ticket.assignedStaffName}
              </span>
            )}
          </div>
        </div>

        {/* Main workspace */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat area — 60% */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-slate-50 py-4">
              <div className="space-y-1">
                {ticket.messages.map((msg) => (
                  <ChatBubble
                    key={msg.id}
                    type={
                      msg.senderType === "STAFF"
                        ? "staff"
                        : msg.senderType === "SYSTEM"
                          ? "system"
                          : "player"
                    }
                    content={msg.body}
                    timestamp={msg.createdAt}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Reply box */}
            {!isClosed && (
              <form
                onSubmit={handleSendReply}
                className="flex-shrink-0 border-t border-slate-200 bg-white p-4"
              >
                {actionError && (
                  <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                    {actionError}
                  </p>
                )}
                <div className="flex gap-2">
                  <textarea
                    ref={textareaRef}
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="輸入回覆內容... (Ctrl+Enter 送出)"
                    className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <div className="flex flex-col justify-end">
                    <button
                      type="submit"
                      disabled={isSending || !replyText.trim()}
                      className="flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSending ? (
                        <>
                          <svg
                            className="h-4 w-4 animate-spin"
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
                          送出中
                        </>
                      ) : (
                        <>
                          送出
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {isClosed && (
              <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
                工單已關閉，無法繼續回覆
              </div>
            )}

            {/* Action bar */}
            {!isClosed && (
              <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleAssignToMe}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    指派給我
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(true)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    轉交給...
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCloseModal(true)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100"
                  >
                    關閉工單
                  </button>
                  {actionError && !replyText && (
                    <p className="ml-auto text-xs text-red-600">{actionError}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Player context panel — 40% */}
          <aside className="hidden w-80 flex-shrink-0 border-l border-slate-200 bg-white xl:flex xl:flex-col">
            <div className="flex-shrink-0 border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">玩家資訊</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PlayerContextPanel
                player={player}
                isLoading={isLoadingPlayer}
              />
            </div>
            {/* Link to create new ticket */}
            {player && (
              <div className="flex-shrink-0 border-t border-slate-200 p-4">
                <Link
                  href={`/tickets/new?playerId=${player.id}`}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  為此玩家建立新工單
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
