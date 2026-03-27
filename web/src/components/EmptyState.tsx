interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon = "inbox", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-6">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant">{icon}</span>
      </div>
      <h3 className="font-headline text-lg font-bold text-on-surface mb-2">
        {title}
      </h3>
      {description && (
        <p className="font-body text-sm text-on-surface-variant max-w-sm mb-8">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary text-sm font-semibold font-label shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 active:scale-95"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
