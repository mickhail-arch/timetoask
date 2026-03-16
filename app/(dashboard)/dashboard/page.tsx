import { PageHeader } from '@/components/app/page-header';
import { ToolsGrid } from '@/components/app/tools-grid';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Инструменты" subtitle="Выберите инструмент для работы" />
      <ToolsGrid />
    </div>
  );
}
