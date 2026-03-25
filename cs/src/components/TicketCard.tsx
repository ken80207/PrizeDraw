import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { CategoryIcon, getCategoryLabel } from "./CategoryIcon";

export interface Ticket {
  id: string;
  ticketNumber?: number;
  playerId: string;
  playerName?: string;
  category: string;
  subject: string;
  status: string;
  assignedStaffName?: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  createdAt: string;
  unreadCount?: number;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "剛剛";
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

interface TicketCardProps {
  ticket: Ticket;
}

export function TicketCard({ ticket }: TicketCardProps) {
  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-indigo-300 hover:shadow-sm"
    >
      {/* Category icon */}
      <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-lg group-hover:bg-indigo-50">
        <CategoryIcon category={ticket.category} />
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-slate-400">
            #{ticket.ticketNumber}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
            {getCategoryLabel(ticket.category)}
          </span>
          <StatusBadge status={ticket.status} />
          {ticket.unreadCount != null && ticket.unreadCount > 0 && (
            <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold leading-none text-white">
              {ticket.unreadCount}
            </span>
          )}
        </div>
        <p className="mt-1 font-medium text-slate-800 truncate">{ticket.subject}</p>
        {ticket.lastMessagePreview && (
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {ticket.lastMessagePreview}
          </p>
        )}
        <p className="mt-0.5 text-xs text-slate-400">{ticket.playerName}</p>
      </div>

      {/* Right side */}
      <div className="flex flex-shrink-0 flex-col items-end gap-1 text-right">
        <span className="text-xs text-slate-400">
          {timeAgo(ticket.lastMessageAt || ticket.createdAt)}
        </span>
        {ticket.assignedStaffName && (
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-600">
            {ticket.assignedStaffName}
          </span>
        )}
      </div>
    </Link>
  );
}
