export function PageHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        {badge}
      </div>
      {subtitle && (
        <p className="text-sm text-text-secondary">{subtitle}</p>
      )}
    </div>
  );
}
