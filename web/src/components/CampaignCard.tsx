import Link from "next/link";
import { StatusBadge } from "./StatusBadge";

export interface CampaignCardData {
  id: string;
  title: string;
  type: "一番賞" | "無限賞";
  coverImageUrl?: string | null;
  pricePerDraw: number;
  status: string;
  remainingTickets?: number;
  totalTickets?: number;
  viewerCount?: number;
  isHot?: boolean;
}

interface CampaignCardProps {
  campaign: CampaignCardData;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const href =
    campaign.type === "無限賞"
      ? `/campaigns/unlimited/${campaign.id}`
      : `/campaigns/${campaign.id}`;

  return (
    <Link href={href} className="group block">
      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-200">
        {/* Cover image */}
        <div className="relative w-full h-48 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 overflow-hidden">
          {campaign.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={campaign.coverImageUrl}
              alt={campaign.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              {campaign.type === "無限賞" ? "🎲" : "🎫"}
            </div>
          )}
          {campaign.isHot && (
            <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              🔥 熱抽中
            </div>
          )}
          <div className="absolute top-2 right-2">
            <StatusBadge status={campaign.type} />
          </div>
        </div>

        {/* Card body */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {campaign.title}
          </h3>
          <div className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 font-medium mb-3">
            <span>💰</span>
            <span>{campaign.pricePerDraw} 點/抽</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            {campaign.remainingTickets !== undefined && campaign.totalTickets !== undefined ? (
              <span>剩餘: {campaign.remainingTickets}/{campaign.totalTickets}</span>
            ) : (
              <StatusBadge status={campaign.status} />
            )}
            {campaign.viewerCount !== undefined && (
              <span>👀 {campaign.viewerCount} 人觀看</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
