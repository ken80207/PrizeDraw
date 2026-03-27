import Link from "next/link";
import { GradeBadge } from "./GradeBadge";
import { StatusBadge } from "./StatusBadge";

export interface PrizeCardData {
  id: string;
  name: string;
  grade: string;
  photoUrl?: string | null;
  sourceCampaign: string;
  acquisitionDate: string;
  status: string;
}

interface PrizeCardProps {
  prize: PrizeCardData;
}

export function PrizeCard({ prize }: PrizeCardProps) {
  return (
    <Link href={`/prizes/${prize.id}`} className="group block">
      <div
        data-testid="prize-card"
        className="rounded-lg overflow-hidden bg-surface-container hover:shadow-[0_16px_32px_rgba(0,0,0,0.4)] transition-all duration-500 hover:-translate-y-1.5"
      >
        {/* Prize image */}
        <div className="relative w-full h-44 bg-surface-container-low overflow-hidden group-hover:bg-surface-container-high transition-colors">
          {prize.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prize.photoUrl}
              alt={prize.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/40">
                trophy
              </span>
            </div>
          )}
          <div className="absolute top-3 left-3">
            <GradeBadge grade={prize.grade} />
          </div>
        </div>

        {/* Card body */}
        <div className="p-4">
          <h3 className="font-headline font-bold text-on-surface text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">
            {prize.name}
          </h3>
          <p className="font-body text-xs text-on-surface-variant mb-3 line-clamp-1">
            來源: {prize.sourceCampaign}
          </p>
          <div className="flex items-center justify-between">
            <span className="font-label text-xs text-on-surface-variant/60">
              {prize.acquisitionDate}
            </span>
            <StatusBadge status={prize.status} />
          </div>
        </div>
      </div>
    </Link>
  );
}
