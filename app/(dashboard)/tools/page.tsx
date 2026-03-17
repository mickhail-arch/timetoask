import { PageHeader } from '@/components/app/page-header';
import { ToolsGrid } from '@/components/app/tools-grid';

export default function ToolsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Инструменты" subtitle="Выберите инструмент для работы" />
      <ToolsGrid />
    </div>
  );
}
