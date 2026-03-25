interface CategoryIconProps {
  category: string;
  className?: string;
}

const CATEGORY_MAP: Record<string, { icon: string; label: string }> = {
  TRADE_DISPUTE: { icon: "⚖️", label: "交易爭議" },
  ACCOUNT: { icon: "👤", label: "帳戶問題" },
  PAYMENT: { icon: "💳", label: "付款問題" },
  SHIPPING: { icon: "📦", label: "出貨問題" },
  DRAW_ISSUE: { icon: "🎰", label: "抽獎異常" },
  PRIZE: { icon: "🏆", label: "賞品問題" },
  REFUND: { icon: "💰", label: "退款申請" },
  OTHER: { icon: "💬", label: "其他" },
};

export function CategoryIcon({ category, className = "" }: CategoryIconProps) {
  const config = CATEGORY_MAP[category] ?? { icon: "📋", label: category };
  return (
    <span className={className} title={config.label} aria-label={config.label}>
      {config.icon}
    </span>
  );
}

export function getCategoryLabel(category: string): string {
  return CATEGORY_MAP[category]?.label ?? category;
}
