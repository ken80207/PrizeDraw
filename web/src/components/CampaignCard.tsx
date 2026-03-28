import Link from "next/link";
import { useTranslations } from "next-intl";
import { FavoriteButton } from "@/components/FavoriteButton";

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
  isFavorited?: boolean;
}

interface CampaignCardProps {
  campaign: CampaignCardData;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const tc = useTranslations("campaign");
  const tcommon = useTranslations("common");

  const href =
    campaign.type === "無限賞"
      ? `/campaigns/unlimited/${campaign.id}`
      : `/campaigns/${campaign.id}`;

  const remainingPct =
    campaign.remainingTickets !== undefined && campaign.totalTickets
      ? Math.round((campaign.remainingTickets / campaign.totalTickets) * 100)
      : null;

  // Display the type badge label using translation keys
  const typeBadge = campaign.type === "無限賞" ? tc("unlimited") : tc("ichiban");

  return (
    <Link href={href} className="group block">
      <div className="relative bg-surface-container rounded-lg flex flex-col transition-all duration-300 hover:-translate-y-2 gacha-glow overflow-hidden">
        {/* Cover image */}
        <div className="relative h-64 overflow-hidden bg-surface-container-high">
          {campaign.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={campaign.coverImageUrl}
              alt={campaign.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-6xl text-on-surface-variant opacity-40">
                {campaign.type === "無限賞" ? "all_inclusive" : "confirmation_number"}
              </span>
            </div>
          )}

          {/* Viewer count badge */}
          {campaign.viewerCount !== undefined && (
            <div
              className={`absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md ${
                campaign.isHot
                  ? "bg-error-container/90 text-on-error-container"
                  : "bg-surface-container-highest/90 text-on-surface"
              }`}
            >
              {campaign.isHot && (
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              )}
              Live: {campaign.viewerCount}
            </div>
          )}

          {/* Type badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                campaign.type === "無限賞"
                  ? "bg-tertiary/10 text-tertiary"
                  : "bg-primary/10 text-primary border border-primary/20"
              }`}
            >
              {typeBadge}
            </span>
          </div>

          {/* Favorite button */}
          <FavoriteButton
            campaignType={campaign.type === "無限賞" ? "unlimited" : "kuji"}
            campaignId={campaign.id}
            initialFavorited={campaign.isFavorited ?? false}
            className="absolute top-2 right-2 text-2xl"
          />
        </div>

        {/* Card body */}
        <div className="p-6 flex flex-col flex-1">
          <h3 className="text-xl font-bold mb-2 text-on-surface group-hover:text-primary transition-colors line-clamp-2">
            {campaign.title}
          </h3>

          <div className="flex justify-between items-center mb-6">
            <span className="text-2xl font-black text-primary font-headline">
              {campaign.pricePerDraw} {tcommon("pts")}
            </span>
            <span className="text-xs text-secondary/60">{tc("drawCount")}</span>
          </div>

          {/* Remaining tickets progress bar (Ichiban Kuji only) */}
          {remainingPct !== null && campaign.totalTickets !== undefined && (
            <div className="space-y-2 mt-auto">
              <div className="flex justify-between text-xs font-bold text-on-surface">
                <span>{tc("available")}</span>
                <span className="text-primary">
                  {campaign.remainingTickets} / {campaign.totalTickets}
                </span>
              </div>
              <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-500"
                  style={{ width: `${remainingPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
