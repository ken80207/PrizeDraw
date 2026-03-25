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
      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-200">
        {/* Prize image */}
        <div className="relative w-full h-40 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
          {prize.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prize.photoUrl}
              alt={prize.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">
              🏆
            </div>
          )}
          <div className="absolute top-2 left-2">
            <GradeBadge grade={prize.grade} />
          </div>
        </div>

        {/* Card body */}
        <div className="p-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-2 mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {prize.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-1">
            來源: {prize.sourceCampaign}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {prize.acquisitionDate}
            </span>
            <StatusBadge status={prize.status} />
          </div>
        </div>
      </div>
    </Link>
  );
}
