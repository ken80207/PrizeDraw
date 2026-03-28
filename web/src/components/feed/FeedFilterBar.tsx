"use client";

import { useFeedStore } from "@/stores/feedStore";

const GRADES = ["SSR", "SR", "R", "N"];

export default function FeedFilterBar() {
  const { items, selectedCampaignIds, selectedGrades, connected, toggleCampaignFilter, toggleGradeFilter, clearFilters } =
    useFeedStore();

  const campaigns = Array.from(
    new Map(items.map((i) => [i.campaignId, i.campaignTitle])).entries(),
  );

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {campaigns.map(([id, title]) => (
        <button
          key={id}
          onClick={() => toggleCampaignFilter(id)}
          className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
            selectedCampaignIds.has(id)
              ? "border-primary bg-primary/20 text-primary"
              : "border-white/10 bg-surface-container-low text-on-surface-variant"
          }`}
        >
          {title}
        </button>
      ))}

      {GRADES.map((grade) => (
        <button
          key={grade}
          onClick={() => toggleGradeFilter(grade)}
          className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
            selectedGrades.has(grade)
              ? "border-primary bg-primary/20 text-primary"
              : "border-white/10 bg-surface-container-low text-on-surface-variant"
          }`}
        >
          {grade}
        </button>
      ))}

      {(selectedCampaignIds.size > 0 || selectedGrades.size > 0) && (
        <button
          onClick={clearFilters}
          className="px-3 py-1.5 rounded-lg text-xs border border-white/10 bg-surface-container-low text-on-surface-variant hover:text-on-surface"
        >
          清除篩選
        </button>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-gray-500"}`} />
        <span className="text-xs text-on-surface-variant">
          {connected ? "即時" : "離線"}
        </span>
      </div>
    </div>
  );
}
